# Field OS — Conclusão do Redesign (Design)

> Cobre as 3 peças finais do redesign "Field OS" iniciado em `2026-07-18-field-os-dashboard-design.md`:
> Dashboard com gráficos e cores, Calendário de Registros Diários, Configurações em abas.
> Cada peça vira um plano de implementação separado (backend habilitador + 3 frontends), mas
> compartilham este único design doc por serem o fechamento do mesmo esforço maior.

## Contexto

O redesign "Field OS" já entregou: backend de dashboard (`GET /api/v1/dashboard/`), frontend de
Dashboard (tiles + alertas + lista de projetos ativos, sem gráficos), frontend de Projetos (cards,
modal de edição, busca), e o wizard de RDO de 6 passos. Faltam 3 peças, todas pedidas juntas nesta
sessão:

1. Dashboard mais visual — gráficos e cores, "seguindo os princípios das maiores empresas do
   mundo" (leitura rápida, cores semânticas, hierarquia visual clara — não um mockup literal, ver
   decisão abaixo).
2. Registros Diários exibidos em calendário mensal (estilo Google Agenda), substituindo a lista
   simples atual.
3. Configurações do projeto reorganizadas em abas em vez de cards empilhados.

## Decisões confirmadas com o usuário

- **Mockup do Dashboard** (print com gráfico de barras, alertas com ícones, progress bars): é
  **referência de estilo/vibe**, não um layout literal a replicar. O layout final é desenhado a
  partir dos dados reais já disponíveis no backend (não existe, por exemplo, campo de "status" tipo
  "OK" no `RegistroDiario` — não há workflow de aprovação nesta versão, então nenhum badge desse
  tipo é inventado).
- **Modelo de calendário**: grade mensal com indicador por dia (não um toggle lista/calendário — o
  calendário **substitui** a lista como visão principal).
- **Escopo de Configurações**: só reorganização em abas. Mesmas 4 seções (Disciplinas, Metas,
  Equipes, Valores), mesma lógica de negócio, zero mudança de comportamento.
- **Nova dependência aprovada**: `recharts` (gráficos no Dashboard). Nenhuma lib de calendário é
  necessária — a grade mensal é matemática de `Date` nativo (KISS/YAGNI, evita overhead de uma lib
  como FullCalendar para um caso de uso simples).

## Arquitetura

Um design, quatro unidades de implementação independentes e testáveis:

```
1. Backend      → habilita 2 e 3 (extensão de endpoints existentes, sem endpoint novo)
2. Frontend     → Dashboard: gráficos (Recharts) + cores semânticas
3. Frontend     → Calendário de Registros Diários (substitui RegistrosDiariosListPage)
4. Frontend     → Configuracões em Tabs
```

Cada unidade termina em estado funcional e testável (build + lint + e2e verdes), sem depender de
as outras 3 estarem prontas — a única dependência real é 1 antes de 2 e 3 (2 e 4 não dependem de
nada novo do backend).

---

## 1. Backend

### 1.1 `GET /api/v1/dashboard/` ganha `atividade_rdo`

Novo campo na resposta: lista dos últimos 7 dias (hoje inclusive) com contagem de RDOs de todos os
projetos ativos da empresa autenticada:

```json
"atividade_rdo": [
  {"data": "2026-07-15", "quantidade": 3},
  {"data": "2026-07-16", "quantidade": 0},
  {"data": "2026-07-17", "quantidade": 5},
  {"data": "2026-07-18", "quantidade": 2},
  {"data": "2026-07-19", "quantidade": 0},
  {"data": "2026-07-20", "quantidade": 1},
  {"data": "2026-07-21", "quantidade": 4}
]
```

- Ordenado do dia mais antigo pro mais recente (ordem natural de leitura esquerda→direita num
  gráfico de barras).
- Dias sem nenhum RDO aparecem com `quantidade: 0` explícito — o gráfico não pode "pular" um dia,
  senão a leitura do eixo X fica errada.
- Implementado com uma agregação (`Count`) sobre `RegistroDiario` filtrado por
  `projeto__in=projetos_ativos` e `data_referencia` nos últimos 7 dias, agrupado por
  `data_referencia`; dias ausentes no resultado da query são preenchidos com 0 em Python (não dá
  pra confiar que o banco retorna linhas pra dias sem registro).

### 1.2 `GET /api/v1/projetos/{id}/registros-diarios/` ganha filtro `?mes=YYYY-MM`

- Query param opcional. Quando presente (`?mes=2026-07`), filtra o queryset por
  `data_referencia__year` e `data_referencia__month` correspondentes, **sem paginação** — a view
  troca a `pagination_class` para `None` só quando o filtro está presente (comportamento atual sem
  o parâmetro fica 100% intacto, incluindo paginação, usado hoje por "duplicar dia anterior").
- Formato inválido de `mes` (ex: string não numérica) → `400 Bad Request` com mensagem clara, nunca
  um 500.

---

## 2. Dashboard — gráficos e cores

Layout final (substituindo o `DashboardPage.tsx` atual):

- **Resumo** (mantém 4 tiles: ativos/pausados/concluídos/execução média), cada tile ganha um ícone
  (lucide-react, já usado em outras páginas) ao lado do número.
- **Gráfico "RDOs por dia"** — `BarChart` do Recharts, eixo X com os 7 dias formatados
  (`dd/MM` ou dia da semana abreviado), eixo Y contagem, uma cor sólida do design system
  (`--color-primary`). Sem dado (todos os 7 dias zerados) → mostra o gráfico com barras vazias
  normalmente (não é um estado de erro, é um dia comum sem RDO).
- **Gráfico de distribuição de status** — `PieChart`/donut do Recharts com 3 fatias
  (ativos/pausados/concluídos), usando as mesmas cores semânticas já definidas em
  `STATUS_BADGE_CLASS` (verde/âmbar/cinza) para consistência com os badges de projeto. Se todos os
  contadores forem 0 (empresa sem nenhum projeto), o gráfico não renderiza — mostra o `EmptyState`
  já existente no lugar de um donut vazio sem sentido.
- **Projetos ativos**: mantém a lista/links atuais, mas a barra de execução (`Progress`) ganha cor
  por faixa — vermelho (`<30%`), âmbar (`30–70%`), verde (`>70%`) — leitura tipo "farol de saúde do
  projeto", padrão comum em dashboards de operação (Asana, Salesforce). Continua não renderizando
  a barra quando `execucao_percentual` é `null` (sem meta cadastrada) — nunca inventa 0%.
- **Alertas de RDO**: mesma lógica e mensagens atuais, ganha ícone de alerta (lucide `AlertTriangle`
  ou similar) ao lado de cada item.

---

## 3. Calendário de Registros Diários

`RegistrosDiariosListPage` é reescrita para renderizar uma grade mensal em vez da lista atual.

- **Cabeçalho de navegação**: `<` (mês anterior) / rótulo do mês+ano por extenso / `>` (mês
  seguinte) / botão "Hoje" (volta pro mês atual). Estado do mês exibido vive como
  `useState<{ano: number, mes: number}>` na própria página.
- **Grade**: 7 colunas (dom–sáb), linhas suficientes para cobrir o mês (calculado com `Date`
  nativo — primeiro dia do mês, `getDay()` pra saber o offset, `getDate()` do último dia do mês
  seguinte -1 dia pra saber quantos dias tem).
- **Célula de dia**: número do dia; dias fora do mês corrente (preenchendo a grade) aparecem
  esmaecidos e não clicáveis; o dia de hoje ganha destaque visual (borda ou fundo diferenciado).
- **Indicador de RDO**: dias com 1+ RDO mostram um badge colorido com a contagem quando >1 (não há
  restrição de unicidade por dia no backend — turno diurno e noturno podem gerar 2 RDOs no mesmo
  dia).
- **Interação de clique**:
  - Dia vazio (dentro do mês corrente) → navega para `/projetos/{id}/registros-diarios/novo?data=YYYY-MM-DD`.
  - Dia com exatamente 1 RDO → navega direto para `/projetos/{id}/registros-diarios/{rdoId}`.
  - Dia com 2+ RDOs → abre um popover/lista inline (não navega) com um link por RDO
    (`turno — clima`, igual ao texto que a lista atual já mostrava), cada um levando ao detalhe.
- **Dados**: busca via `useRegistrosDiarios(projetoId, { mes: 'YYYY-MM' })` (hook existente ganha um
  parâmetro opcional `mes`, refaz a query ao trocar de mês — mesmo padrão já usado no `enabled` de
  `useProjetos`).
- **`RdoPage` ganha suporte a pré-preencher a data**: lê `?data=YYYY-MM-DD` da URL (via
  `useSearchParams`) e usa esse valor como estado inicial de `dataReferencia` em vez de string
  vazia. Sem o parâmetro, comportamento atual (campo vazio) intacto.
- **Estado vazio** (projeto sem nenhum RDO no mês nenhum): a grade aparece normalmente, todas as
  células sem indicador — não é um "erro", é a leitura correta de um mês sem registros.

---

## 4. Configurações em Tabs

- `ConfiguracaoPage` reestruturada: em vez de 4 `Card`s empilhados, um único `Tabs` com
  `TabsList` (Disciplinas / Metas / Equipes / Valores) e um `TabsContent` por seção, cada um
  contendo exatamente o mesmo JSX/lógica que já existe hoje dentro do respectivo `Card`.
  - Nenhuma mudança de handlers, hooks, ou validação — só a estrutura de apresentação.
  - Aba inicial: "Disciplinas" (primeira da lista, ordem já natural pela dependência — Metas
    depende de Disciplina existir).

---

## Testes

Convenção já estabelecida nesta sessão: E2E (Playwright) é a única camada de teste no frontend
(sem unit tests). Cada plano de implementação vai cobrir:

- **Backend**: testes pytest para `atividade_rdo` (dias com e sem RDO, preenchimento de zeros,
  ordenação) e para o filtro `?mes=` (mês com RDOs, mês vazio, formato inválido → 400, comportamento
  sem o parâmetro inalterado).
- **Dashboard frontend**: e2e cobrindo gráficos renderizando com dado mockado, estado vazio (sem
  projetos) do donut, cor da barra de execução por faixa.
- **Calendário frontend**: e2e cobrindo navegação entre meses, clique em dia vazio (vai pra
  "Novo RDO" com data preenchida), clique em dia com 1 RDO (vai pro detalhe), clique em dia com 2+
  RDOs (abre a lista/popover).
- **Configurações frontend**: e2e cobrindo troca de aba mantendo os formulários funcionais
  (reaproveita os testes atuais, só ajustando a navegação por abas).

## Fora de escopo

- Workflow de aprovação de RDO (badge "OK"/pendente) — não existe no modelo de dados desta versão,
  não é adicionado aqui.
- Edição/exclusão de RDO a partir do calendário — só criação (dia vazio) e navegação pro detalhe
  (dia com RDO). Edição de RDO já existente não está implementada em nenhuma tela hoje.
- Filtros adicionais no calendário (por equipe, por turno) — YAGNI, não foi pedido.
- Revisão de conteúdo/UX das 4 seções de Configurações — só reorganização em abas, confirmado com
  o usuário.
