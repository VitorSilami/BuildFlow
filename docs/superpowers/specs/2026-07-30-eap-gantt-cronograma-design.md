# EAP — Gantt / Cronograma Visual

## Contexto

Esta é a quinta peça do backlog "EAP completa" (após estrutura peso/quantidade, integração
RDO→EAP, carta de controle de produtividade, e datas previstas/aderência — todas já em produção).
Esta peça consome diretamente o trabalho da peça anterior (datas previstas): sem
`data_inicio_prevista`/`data_fim_prevista` por serviço não haveria base pra desenhar nenhuma barra
de cronograma.

O protótipo de referência (`EPR_Daily_Completo.html`, função `drawEAPGantt`, linhas 4178-4218) tem
uma sub-aba "Gantt" dentro da aba EAP: um SVG com uma linha por disciplina de topo, barra horizontal
da data de início à data de fim (derivadas do min/max das datas dos serviços filhos), preenchimento
proporcional ao avanço real, cor pelo status, grade de meses de fundo e uma linha tracejada "HOJE".

## Escopo desta rodada

- Uma barra por **Disciplina** (não por serviço) — visão gerencial enxuta, mesmo espírito de
  "disciplinas de topo" do protótipo, adaptado à nossa estrutura atual de 2 níveis
  (Disciplina→Serviço, sem hierarquia N-níveis ainda).
- Janela (início/fim) de cada disciplina derivada do min/max das datas previstas dos serviços
  filhos — mesmo princípio já usado pro avanço previsto da disciplina (rollup, nunca um dado
  digitado diretamente na disciplina).
- Implementação com **Recharts** (já usado nas duas fatias anteriores — carta de controle, gráfico
  de atividade — mesmas variáveis de cor CSS, mesmo padrão de teste). Avaliei alternativas de
  mercado (`gantt-task-react`, SVAR React Gantt, DHTMLX Community, Frappe Gantt — todas MIT) mas,
  como o uso aqui é somente leitura (sem arrastar/editar cronograma, sem dependências entre
  tarefas), a consistência com o resto do projeto pesa mais que os recursos de uma biblioteca
  dedicada de gestão de projeto.
- Cor da barra pelo `status_eap` da disciplina; quando `status_eap` é `null` (bases do avanço real e
  previsto não batem, ou dado insuficiente), usa cinza neutro — mesma cor já usada em "Não
  iniciado".
- Localização na UI: um toggle "Ver cronograma (Gantt)" acima da lista de disciplinas já existente
  na aba EAP — sem sub-abas novas, sem navegação nova.

## Fora de escopo (backlog para specs futuras)

- Gantt por serviço (nível mais detalhado) — pode virar uma spec futura se houver demanda.
- Qualquer edição de cronograma pelo próprio Gantt (arrastar barra pra mudar data) — só
  visualização, mesma decisão já tomada pra carta de controle (sem interatividade de escrita).
- Hierarquia N-níveis, importação/exportação CSV — outras peças do mesmo backlog, específicas.
- Dependências entre tarefas (predecessor/sucessor) — não existe no protótipo nem no modelo atual.

## Cálculo (`buildflow/projetos/services.py`)

Nova função:

```python
def calcular_janela_disciplina(disciplina: Disciplina) -> tuple[datetime.date, datetime.date] | None:
    """Janela (inicio, fim) de uma disciplina para o Gantt: menor
    data_inicio_prevista e maior data_fim_prevista entre os servicos filhos
    que tem ambas as datas definidas. Sem nenhum servico com as duas datas,
    retorna None — disciplina nao aparece no Gantt, nunca inventa uma janela.
    """
    servicos_com_janela = [
        s
        for s in disciplina.servicos.all()
        if s.data_inicio_prevista is not None and s.data_fim_prevista is not None
    ]
    if not servicos_com_janela:
        return None
    return (
        min(s.data_inicio_prevista for s in servicos_com_janela),
        max(s.data_fim_prevista for s in servicos_com_janela),
    )
```

Um serviço só entra na janela se tiver **as duas** datas definidas (mesma regra de
`calcular_avanco_previsto_servico`, que já exige ambas para calcular qualquer coisa).

## API (`buildflow/configuracoes/serializers.py`)

`DisciplinaSerializer` ganha dois campos computados, com os mesmos nomes já usados em
`CatalogoServico` — o frontend consome o mesmo shape independente da origem (serviço ou disciplina
calculada):

```python
data_inicio_prevista = serializers.SerializerMethodField()
data_fim_prevista = serializers.SerializerMethodField()

def get_data_inicio_prevista(self, obj: Disciplina) -> str | None:
    janela = self._janela(obj)
    return janela[0].isoformat() if janela else None

def get_data_fim_prevista(self, obj: Disciplina) -> str | None:
    janela = self._janela(obj)
    return janela[1].isoformat() if janela else None

def _janela(self, obj: Disciplina) -> tuple[datetime.date, datetime.date] | None:
    cache = self.context.setdefault("_janela_disciplina_cache", {})
    if obj.pk not in cache:
        cache[obj.pk] = calcular_janela_disciplina(obj)
    return cache[obj.pk]
```

(reaproveita o padrão de cache por `self.context` já introduzido na fatia anterior pra evitar
recálculo duplicado entre os dois métodos — sem query nova, é só iteração em Python sobre
`disciplina.servicos.all()`.)

Com isso, `DisciplinaSerializer` expõe tudo que o Gantt precisa: `id`, `nome`,
`data_inicio_prevista`, `data_fim_prevista`, `avanco_percentual`, `status_eap`.

## Frontend

- **`GanttChart.tsx`** (novo componente, mesmo padrão de `CartaControleChart.tsx`): recebe
  `disciplinas: Disciplina[]`, filtra as que têm `data_inicio_prevista`/`data_fim_prevista`
  não-nulos, e renderiza um `BarChart` do Recharts (`layout="vertical"`):
  - Eixo Y categórico (`nome`), eixo X numérico (timestamps em ms).
  - Cada disciplina vira duas séries empilhadas: uma invisível ("offset", do início do domínio até
    a data de início da disciplina) e uma visível ("duração", da data de início até a data de fim)
    — técnica padrão de "barra flutuante" em bibliotecas de gráfico baseadas em barras empilhadas.
  - A série "duração" usa uma `shape` customizada (render-prop do `<Bar>`) que desenha dois
    retângulos na mesma barra: um contorno claro (cor do status, opacidade baixa) cobrindo a
    duração inteira, e um retângulo sólido cobrindo só a fração `avanco_percentual` — reproduz o
    efeito visual do protótipo (barra clara de fundo + preenchimento escuro proporcional ao
    progresso real).
  - Cores por status: Concluído/No prazo → verde; Atenção → âmbar; Crítico → vermelho; Planejado →
    azul; Não iniciado ou `status_eap` nulo → cinza.
  - Ticks do eixo X: um por mês dentro do intervalo (gerados a partir do min/max das janelas de
    todas as disciplinas exibidas), formatados `mmm/aa`.
  - `ReferenceLine` vertical tracejada âmbar em "hoje" — calculado no browser via `new Date()`, não
    vem da API (evita herdar o bug de fuso horário já conhecido no cálculo backend, documentado como
    débito técnico da fatia anterior).
  - Sem nenhuma disciplina com janela válida → componente não renderiza nada, sem aviso — mesmo
    padrão de "ausência de dado não gera mensagem" já usado na carta de controle.
- **`ConfiguracaoPage.tsx`**: na `TabsContent value="eap"` (linhas 137-161 atuais), um botão "Ver
  cronograma (Gantt)" acima da `<ul>` de disciplinas, com estado local (`useState`) controlando a
  visibilidade — mesmo padrão do toggle "Ver lançamentos" já usado em `EapDisciplinaCard`.
- **`types/configuracao.ts`**: `Disciplina` ganha `data_inicio_prevista: string | null` e
  `data_fim_prevista: string | null`.

## Testes

- `buildflow/projetos/tests/test_execucao.py`: `calcular_janela_disciplina` — nenhum serviço com as
  duas datas → `None`; um serviço com datas e outro sem (nenhuma das duas ou só uma) → usa só o que
  tem ambas; dois serviços com datas diferentes → retorna o menor início e o maior fim entre eles
  (valores conhecidos, verificáveis à mão).
- `buildflow/configuracoes/tests/test_api.py`: `DisciplinaSerializer` expõe
  `data_inicio_prevista`/`data_fim_prevista` corretos quando há serviço(s) com as duas datas; expõe
  `null`/`null` quando nenhum serviço qualifica.
- `frontend/tests/e2e/config.spec.ts`: toggle "Ver cronograma" oculto por padrão; ao clicar, mostra
  o gráfico (`aria-label` do wrapper, mesmo padrão da carta de controle); disciplina sem janela
  válida não aparece como barra no Gantt; disciplina com `status_eap` nulo não quebra a renderização
  (cor cinza aplicada).
