# EAP — Hierarquia N-níveis

## Contexto

A EAP hoje é fixa em 2 níveis: `Disciplina` → `CatalogoServico` (peso, quantidade, integração
automática com RDO, carta de controle SPC, datas previstas/avanço previsto/status, Gantt — tudo já
implementado e em produção). O protótipo de referência (`EPR_Daily_Completo.html`) descreve uma EAP
com hierarquia arbitrária, usando um código do tipo `001`, `001.001`, `001.001.001...` para
representar profundidade (ver `eapConstroiArvore` no prototipo: lista plana de itens com `codigo`,
árvore reconstruída inferindo o pai a partir do prefixo do código).

Esta spec cobre **só a estrutura em si**: permitir que uma Disciplina tenha subdisciplinas,
formando profundidade arbitrária. Código hierárquico (`001.001`) e importação/exportação CSV ficam
para uma spec futura, quando o import/export for priorizado — o código só faz sentido pleno como
formato de serialização do CSV, e forçá-lo agora seria projetar para um requisito que ainda não
chegou (YAGNI).

## Escopo desta rodada

- `Disciplina` ganha um pai opcional, auto-referenciado — permite Disciplina → Subdisciplina →
  Subsubdisciplina → ... em profundidade arbitrária.
- `CatalogoServico` **continua sempre folha** — pode ser filho de qualquer nível de Disciplina,
  exatamente como hoje. Nenhuma mudança em `CatalogoServico`.
- Todos os cálculos de rollup (avanço real, avanço previsto, status, janela do Gantt) passam a
  considerar subdisciplinas como mais um tipo de filho, junto dos serviços.
- UI: cartões aninhados (subdisciplina renderiza como um card recuado dentro do card do pai — opção
  aprovada durante o brainstorm, comparada visualmente com uma alternativa em árvore indentada).
- Criação de subdisciplina: botão "+ Subdisciplina" dentro de cada card, abrindo o mesmo formulário
  de criar disciplina já com o pai pré-preenchido.

## Fora de escopo (backlog para specs futuras)

- Código hierárquico (`001`, `001.001...`) — fica para quando importação/exportação CSV for
  priorizada, já que é o formato que o CSV usa para descrever a árvore.
- Importação/exportação via CSV/XLSX.
- Qualquer mudança em `CatalogoServico` (continua sempre o nó-folha).

## Modelo de dados

### `Disciplina` (alteração)

Adiciona:
- `pai` (`ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE,
  related_name='subdisciplinas')`) — disciplina pai, quando esta é uma subdisciplina. `None` =
  disciplina raiz (comportamento atual, preservado para todo dado existente).

Migração é puramente aditiva: nenhuma linha existente precisa mudar (`pai` nasce `None` em todas).
`on_delete=CASCADE` propaga a exclusão pela árvore inteira (subdisciplinas e seus serviços), mesmo
comportamento que already existe entre Disciplina e CatalogoServico hoje.

**Prevenção de ciclo:** validado no serializer/`clean()` — ao definir `pai`, percorre a cadeia de
`pai` a partir do valor proposto; se encontrar a própria disciplina nessa cadeia (ou se `pai == self`),
rejeita com erro de validação. Necessário porque a criação inicial de uma disciplina nunca pode
formar ciclo (linha nova), mas a *reatribuição* de pai de uma disciplina já existente (com seus
próprios filhos) pode.

**Peso percentual:** semântica não muda — `peso_percentual` de uma Disciplina continua sendo seu
peso dentro do grupo de irmãos (agora "irmãos" = outros filhos diretos do mesmo `pai`, ou outras
disciplinas raiz quando `pai is None`). O aviso visual de "soma não fecha 100%" passa a considerar
esse grupo de irmãos, e some subdisciplinas + serviços no mesmo pool de peso quando uma disciplina
tem os dois tipos de filho ao mesmo tempo.

## Cálculos (rollup recursivo)

Em `backend/buildflow/projetos/services.py`, quatro funções hoje iteram só
`disciplina.servicos.all()`. Passam a também considerar `disciplina.subdisciplinas.all()`, tratando
cada filho — subdisciplina ou serviço — de forma uniforme (cada um já expõe seu próprio
`avanco_percentual`/`peso_percentual` calculado):

- `calcular_avanco_disciplina` — média ponderada por peso, agora sobre filhos mistos.
- `calcular_avanco_previsto_disciplina` — idem, para o avanço previsto.
- `calcular_status_eap_disciplina` — a checagem "bases batem" (mesmo conjunto de serviços contribui
  para real e previsto) passa a comparar os **serviços-folha de toda a subárvore**, não só os
  filhos diretos.
- `calcular_janela_disciplina` — janela (menor início, maior fim) passa a considerar todos os
  serviços-folha descendentes, em qualquer profundidade.

### Correção necessária: double-counting no nível de projeto

`calcular_execucao_percentual` (KPI de execução do projeto, usado no dashboard) e
`soma_pesos_disciplinas` (aviso visual de peso) hoje fazem `for disciplina in
projeto.disciplinas.all()` — isso inclui **todas** as disciplinas do projeto, raízes e
subdisciplinas juntas, porque `disciplinas` é o `related_name` da FK direta para `Projeto` (toda
Disciplina aponta pro projeto, mesmo sendo subdisciplina). Sem correção, o peso de uma subdisciplina
seria contado duas vezes: uma vez direto nessa soma, e outra embutida dentro do rollup do próprio
pai. Ambas as funções passam a filtrar `projeto.disciplinas.filter(pai__isnull=True)` — só
disciplinas raiz entram no cálculo de nível de projeto.

## API

`DisciplinaSerializer` ganha um campo `subdisciplinas` — auto-referência recursiva (mesmo
serializer, aninhado), devolvendo a árvore já pronta. O endpoint de configuração do projeto
continua devolvendo uma lista de disciplinas raiz, cada uma já trazendo suas `subdisciplinas` (e
essas, as suas, recursivamente) e seus `servicos`. O frontend não precisa reconstruir nenhuma árvore
a partir de `pai_id` — consome a estrutura já aninhada.

Criação de disciplina (`POST`) ganha um campo opcional `pai` (UUID). Validação de ciclo roda no
serializer antes de salvar.

## Frontend

`EapDisciplinaCard` vira recursivo: além de renderizar `disciplina.servicos`, renderiza
`disciplina.subdisciplinas.map(sub => <EapDisciplinaCard disciplina={sub} .../>)` — o componente já
tem exatamente a forma certa pra isso (recebe um `Disciplina`, renderiza filhos), só precisa da
chamada recursiva a mais.

Cada card ganha um botão "+ Subdisciplina" (ao lado do botão existente "Adicionar serviço") que
abre o mesmo formulário de criar disciplina já usado hoje, com o campo `pai` pré-preenchido com o
`id` da disciplina atual. O formulário genérico "Nova Disciplina" (fora de qualquer card, no topo da
aba EAP) continua existindo, sempre criando disciplinas raiz (`pai=None`).

O aviso "a soma dos pesos não fecha 100%" (hoje calculado só sobre `disciplina.servicos`) passa a
somar `disciplina.subdisciplinas` + `disciplina.servicos` juntos, já que ambos competem pelo mesmo
pool de peso dentro do pai.

## Gantt

`GanttChart` continua recebendo uma lista achatada de disciplinas (uma barra por disciplina com
janela válida), mas agora a lista inclui disciplinas de qualquer profundidade, não só raízes — o
frontend achata a árvore recursivamente antes de passar pro componente. Comportamento de "sem
janela válida não aparece" continua idêntico. Sem indentação visual por enquanto — cada barra mostra
só o nome da disciplina, igual hoje (indentação de profundidade fica como possível polish futuro, se
o volume de disciplinas tornar isso confuso na prática).

## Testes

- Backend: `pai` opcional, cascade delete, validação de ciclo (self, e ciclo indireto via avô),
  rollup recursivo (avanço/previsto/status/janela) com filhos mistos (subdisciplina + serviço no
  mesmo nível), correção de double-counting no nível de projeto (peso de subdisciplina não conta
  duas vezes).
- Frontend: renderização recursiva de N níveis, criação de subdisciplina com pai pré-preenchido,
  aviso de soma de pesos considerando filhos mistos, Gantt com disciplinas de profundidades
  diferentes.
