# Custos & Ociosidade (Design)

## Contexto

Primeiro módulo da expansão de escopo do BuildFlow além do MVP `001-mvp-gestao-diaria`, seguindo o
protótipo funcional `EPR_Daily_Completo.html` (raiz do repo) — que cobre, além do RDO já
implementado: RNC (Não Conformidades), EAP completa, Medição, Custos & Ociosidade/Histogramas e
Histórico & Aprovações. A spec original do MVP já registrava esses módulos como backlog explícito
("Não conformidades (RNC), medição de contratos e painéis de custo/ociosidade — presentes no
protótipo HTML mas fora da lista de ações do MVP — ficam no backlog para specs futuras",
`specs/001-mvp-gestao-diaria/spec.md`, seção Assumptions).

**Por que este módulo primeiro**: dos 6 módulos do protótipo, é o de maior valor com menor risco de
schema — cruza dados que **já existem** no sistema (Presença, Apontamento de Máquina, ValorCusto,
MotivoParada, todos de `registros_diarios`/`configuracoes`) sem exigir nenhum cadastro operacional
novo. Os demais módulos (EAP completa, RNC, Medição, Histórico & Aprovações) ficam como iniciativas
separadas, cada uma com seu próprio spec/plano quando priorizada.

**Decisões confirmadas com o usuário antes de desenhar**:
- Novo app Django isolado (`custos_ociosidade`), não misturado em `configuracoes`.
- Custo atribuído por função (mão de obra) e por máquina individual cadastrada (equipamento) —
  não um valor médio único — para reproduzir as quebras reais do protótipo (histograma por
  função/por equipamento).
- Módulo introduz a **primeira restrição real por perfil** do sistema: só o perfil `gerente` acessa
  (o MVP original deixou perfis sem diferença funcional; este é o primeiro caso onde o próprio
  protótipo exige isso — "Estes valores não aparecem para o encarregado").
- Escopo **por projeto** nesta rodada (mesma navegação de RDO/Configurações — entra num projeto e
  vê o custo/ociosidade daquele projeto no mês). Uma visão comparativa entre todos os projetos da
  empresa foi cogitada e fica como próximo passo natural, não nesta rodada.

## O que o protótipo mostra (KPIs e quebras)

- KPIs: custo de mão de obra, déficit de mão de obra (faltas), custo de máquinas, custo ocioso de
  máquinas, custo total do mês, ociosidade evitável total, horas ociosas totais, eficiência
  gerencial geral.
- Histograma de mão de obra por função (custo trabalhado vs. déficit por faltas).
- Histograma de máquinas por equipamento (custo produtivo vs. custo ocioso).
- Tabela de eficiência e custo parado por equipamento.
- Horas ociosas agrupadas por causa (motivo de parada).
- Lista de faltas por pessoa, com destaque para reincidência (≥3 faltas no mês).

## Arquitetura

Novo app Django `custos_ociosidade`, somente leitura — nenhum model próprio de dado operacional,
só um serviço de agregação (`services.py`) e uma view (`views.py`) que cruzam:
- `registros_diarios.Presenca` (status presente/falta/atestado, função registrada no RDO)
- `registros_diarios.ApontamentoMaquina` (horas produtivas/paradas, motivo de parada, máquina)
- `configuracoes.ValorCusto` (valores cadastrados, estendido nesta spec — ver Schema)
- `configuracoes.MotivoParada` (já existe, reaproveitado 1:1)

Endpoint: `GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM` — `mes` é obrigatório (400 sem
ele; "custo do mês" sem mês é ambíguo). Mesmo parser/mensagem de erro de formato já usado em
`RegistroDiarioViewSet._parse_filtro_mes` (`registros_diarios/views.py:50-55`).

## Mudança de schema: `ValorCusto` ganha atribuição por função/máquina

`configuracoes.ValorCusto` (hoje: `tipo`, `descricao`, `valor` — um "recorte simplificado" já
documentado no próprio docstring do model) ganha 2 campos opcionais, aditivos:

```python
class ValorCusto(models.Model):
    ...
    funcao = models.CharField(_("função"), max_length=255, blank=True)
    maquina = models.ForeignKey(
        "Maquina",
        verbose_name=_("máquina"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="valores_custo",
    )

    class Meta:
        ...
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tipo="mao_de_obra", maquina__isnull=True)
                    | models.Q(tipo="equipamento", funcao="")
                ),
                name="valor_custo_funcao_ou_maquina_por_tipo",
            ),
        ]
```

- `funcao`: só preenchido quando `tipo=mao_de_obra`; casa (case-insensitive, trim) com o texto
  informado em `Presenca.funcao` no RDO — não com `Pessoa.funcao` cadastrada, já que o RDO pode
  registrar alguém numa função diferente da cadastro (empréstimo entre equipes).
- `maquina`: FK opcional só preenchida quando `tipo=equipamento`, aponta para uma `Maquina`
  cadastrada (`configuracoes.Maquina`).
- Um `ValorCusto` sem `funcao`/`maquina` continua válido (não quebra os registros/telas
  existentes) — só não entra em nenhuma quebra por função/equipamento; a UI mostra essas linhas
  como "sem valor definido" nos agrupamentos, nunca inventa um número.
- **Unidade do valor (fixada nesta spec — campo existe desde o MVP mas nunca foi usado em nenhum
  cálculo até agora)**: `valor` é **R$/dia** quando `tipo=mao_de_obra` (diária, mesma unidade do
  protótipo — ~R$300-500/dia) e **R$/hora** quando `tipo=equipamento` (valor-hora de máquina). O
  rótulo do campo "Valor" na tela Configurações → Valores passa a deixar isso explícito
  ("Valor (R$/dia)" ou "Valor (R$/hora)", conforme o `tipo` selecionado).
- `on_delete=models.SET_NULL` na FK de máquina: apagar uma máquina cadastrada não deve apagar o
  histórico de valor de custo — o valor vira "órfão" (sem máquina), mesmo tratamento de "sem valor
  definido" acima.

A tela **Configurações → Valores** (`ConfiguracaoPage.tsx`, aba "valores") ganha 2 campos
condicionais no formulário: um seletor de função (texto livre, mesmo padrão do campo "Função" já
usado em "Adicionar pessoa") quando o tipo escolhido é "Mão de obra"; um seletor de máquina
cadastrada (options vindas de `equipes[].maquinas`, já disponível em `ConfiguracaoProjeto`) quando
o tipo é "Equipamento".

## Regras de cálculo

Todo o cálculo é por projeto, para os RDOs cujo `data_referencia` cai no mês pedido.

**Mão de obra** (por `Presenca`):
- `status=presente` → 1 dia trabalhado para aquela função.
- `status=falta` → 1 falta para aquela função (gera déficit financeiro — ociosidade evitável).
- `status=atestado` → 1 atestado para aquela função (só informativo, sem custo atribuído —
  afastamento justificado não é "ociosidade evitável" da mesma forma que uma falta simples).
- `custo_mao_de_obra` = Σ (dias trabalhados por função × diária da função, quando há `ValorCusto`
  correspondente; senão 0, função listada como "sem valor definido").
- `deficit_mao_de_obra` = Σ (faltas por função × diária da função, mesma regra de "sem valor").

**Máquinas** (por `ApontamentoMaquina`):
- Com `maquina` cadastrada e `ValorCusto` correspondente: `custo_produtivo` = horas produtivas ×
  valor-hora; `custo_ocioso` = horas paradas × valor-hora.
- Avulso (`identificacao_avulsa`, sem `Maquina` cadastrada) ou sem `ValorCusto` correspondente:
  entra nas **horas** (produtivas/paradas) mas fica fora do **R$** — nunca inventa um valor-hora.
- `eficiencia_percentual` = produtivas ÷ (produtivas + paradas) × 100, arredondado; `null` quando
  não há horas registradas no período (nunca inventa número — mesmo princípio já usado em
  `calcular_execucao_percentual`, `projetos/services.py`).

**Agregados do mês**:
- `custo_total` = `custo_mao_de_obra` + `custo_produtivo_maquinas`.
- `ociosidade_evitavel_total` = `custo_ocioso_maquinas` + `deficit_mao_de_obra`.
- `horas_ociosas_total` = Σ horas paradas de todos os apontamentos do mês (com ou sem `ValorCusto`
  — é uma métrica de horas, não depende de custo cadastrado).
- `eficiencia_gerencial_percentual` = Σ horas produtivas ÷ Σ (produtivas + paradas) de todos os
  apontamentos do mês × 100; `null` se não houver nenhuma hora registrada.
- `horas_ociosas_por_causa`: agrupa horas paradas por `MotivoParada.descricao` (motivo é `null`
  apenas quando `horas_paradas=0`, regra já existente e validada em `test_validations.py`).
- `faltas_por_pessoa`: só para `Presenca` vinculada a `Pessoa` cadastrada (avulsas não têm
  identidade rastreável entre RDOs distintos — nomes podem divergir). Conta faltas/atestados no
  mês; `reincidente=true` quando faltas ≥ 3; `valor_perdido` = faltas × diária da função
  **registrada no RDO** (não a função cadastrada da pessoa, mesma razão do casamento por função
  acima).

## API

`GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM`

Permissão: `IsAuthenticatedWithEmpresa` (já existe) **e** uma nova `IsGerente` (`core/permissions.py`)
— 403 para perfil `auxiliar_administrativo`. Projeto de outra empresa: 404 (nunca 403/detalhe,
mesmo princípio de isolamento já usado em todo o sistema). `mes` ausente ou em formato inválido:
400 com `{"mes": "Use o formato YYYY-MM."}` (mesma mensagem já usada em `registros_diarios`).

Formato de resposta:

```json
{
  "mes": "2026-07",
  "custo_mao_de_obra": "5000.00",
  "deficit_mao_de_obra": "2500.00",
  "custo_produtivo_maquinas": "12000.00",
  "custo_ocioso_maquinas": "1800.00",
  "custo_total": "17000.00",
  "ociosidade_evitavel_total": "4300.00",
  "horas_ociosas_total": "24.50",
  "eficiencia_gerencial_percentual": 87,
  "mao_de_obra_por_funcao": [
    {
      "funcao": "Ajudante",
      "dias_trabalhados": 20,
      "faltas": 1,
      "atestados": 0,
      "custo": "5000.00",
      "deficit": "250.00",
      "tem_valor_cadastrado": true
    }
  ],
  "maquinas_por_equipamento": [
    {
      "maquina_id": "uuid",
      "codigo": "ESC-01",
      "nome": "Escavadeira 320D",
      "equipe_nome": "Equipe 1",
      "horas_produtivas": "160.00",
      "horas_paradas": "8.00",
      "custo_produtivo": "12000.00",
      "custo_ocioso": "600.00",
      "eficiencia_percentual": 95,
      "tem_valor_cadastrado": true
    }
  ],
  "horas_ociosas_por_causa": [
    { "motivo": "Chuva", "horas": "16.00" }
  ],
  "faltas_por_pessoa": [
    {
      "pessoa_id": "uuid",
      "nome": "José Ajudante",
      "funcao": "Ajudante",
      "faltas": 3,
      "atestados": 1,
      "valor_perdido": "375.00",
      "reincidente": true
    }
  ]
}
```

Todo valor decimal serializado como string (mesma convenção já usada em `decimal_para_str_ou_none`,
`projetos/services.py`), nunca como float.

## Frontend

Nova página `CustosOciosidadePage` (`frontend/src/pages/CustosOciosidadePage.tsx`), rota
`/projetos/:projetoId/custos-ociosidade`. Novo item no `Sidebar`, no grupo "Operação" existente,
visível **apenas** quando `user.perfil === 'gerente'` (campo já presente em
`UsuarioAutenticado.perfil`, `frontend/src/types/auth.ts`, nunca consumido no frontend até agora).

Acesso direto à rota por um `auxiliar_administrativo` (URL digitada manualmente): a página detecta
`user.perfil !== 'gerente'` e mostra uma mensagem de acesso restrito (não uma tela quebrada nem
uma chamada de API fadada a 403 sem contexto).

Layout (mesma identidade visual já estabelecida nas ondas de polish — `Card` com `eyebrow`
mono-caps, `Skeleton` no carregamento, `EmptyState` quando não há dados no mês):
- Seletor de mês no topo (`<input type="month">`, default no mês atual).
- Cards de KPI (custo de mão de obra, déficit, custo de máquinas, custo ocioso, custo total,
  ociosidade evitável, horas ociosas, eficiência gerencial).
- Histograma de mão de obra por função (barra: custo trabalhado vs. déficit).
- Histograma de máquinas por equipamento (barra: custo produtivo vs. custo ocioso).
- Tabela de eficiência e custo parado por equipamento.
- Tabela de horas ociosas por causa.
- Tabela de faltas por pessoa, com indicação visual de reincidência (≥3 faltas).
- Linhas "sem valor definido" (função/máquina sem `ValorCusto` correspondente) aparecem com um
  aviso visual (não escondidas, não com custo inventado).

## Testes

Convenção já estabelecida: Playwright E2E é a camada de teste do frontend; pytest para o backend
(cálculo + isolamento multitenant + permissão).

Backend (pytest):
- Cálculo correto com dados mistos: função/máquina com e sem `ValorCusto` cadastrado.
- `atestado` não entra em déficit; `falta` entra.
- Reincidência (≥3 faltas) marcada corretamente; pessoa avulsa nunca aparece em `faltas_por_pessoa`.
- Eficiência retorna `null` quando não há horas registradas no mês (nunca 0 nem erro).
- Isolamento multitenant: projeto de outra empresa → 404.
- Permissão: perfil `auxiliar_administrativo` → 403; `gerente` → 200.
- `mes` ausente ou mal formatado → 400 com a mensagem padrão.

Frontend (Playwright):
- KPIs e tabelas renderizam corretamente a partir de um mock de resposta completo.
- Linha "sem valor definido" aparece quando `tem_valor_cadastrado=false`.
- Item do Sidebar e acesso à rota: visível/permitido para `gerente`, oculto/bloqueado com mensagem
  para `auxiliar_administrativo`.
- Troca de mês no seletor dispara nova busca com o `?mes=` correto.

## Fora de escopo (nesta rodada)

- Visão comparativa entre todos os projetos da empresa (endpoint agregado
  `GET /api/v1/custos-ociosidade/?mes=`) — cogitada com o usuário, fica como próximo passo natural
  reaproveitando o mesmo serviço de cálculo escrito aqui.
- EAP completa, RNC, Medição, Histórico & Aprovações — módulos independentes do protótipo, cada
  um com seu próprio spec/plano quando priorizado.
- Qualquer edição/exclusão de `ValorCusto`, `Presenca` ou `ApontamentoMaquina` a partir desta tela
  — é somente leitura; edição continua pelas telas já existentes (Configurações, RDO).
