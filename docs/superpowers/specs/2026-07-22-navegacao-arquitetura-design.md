# Arquitetura de Navegação (Sidebar + Contexto do Projeto) — Design

## Contexto

O BuildFlow é um ERP SaaS de gestão operacional de obras. O conceito central do
produto é: a **Empresa** possui vários **Projetos**, e o **Projeto** é o centro de
todo o sistema — toda a navegação de RDO, Histórico, Custos & Ociosidade, RNC e
Configurações existe dentro do contexto de um projeto aberto.

Hoje isso não é comunicado com clareza. A sidebar atual (`Sidebar.tsx`) é uma
lista plana: um item "Dashboard", um item "Projetos", e — só quando há
`:projetoId` na URL — mais 5 itens de projeto aparecem sem nenhuma separação
visual entre "navegação da empresa" e "navegação do projeto". Não existe
indicação de qual projeto está aberto, seu status ou progresso, e o breadcrumb
de cada página (`PageHeader`) não inclui o nome do projeto atual.

Esta rodada refatora a arquitetura de navegação para comunicar constantemente:
em qual empresa/projeto o usuário está, onde está dentro do projeto, e como
voltar ou trocar de projeto — seguindo a referência de IA (não visual) de
Linear, GitHub, Notion, Figma, Jira e Vercel.

## Decisões confirmadas

1. **Nível 1 (Empresa) só com módulos reais**: `Dashboard` e `Projetos`. O
   brief original menciona "Usuários", "Equipes" e "Configurações da Empresa",
   mas essas páginas não existem hoje (Equipes/Máquinas já existem, porém
   dentro de Configurações **do Projeto**, não da empresa) — ficam de fora
   até existirem, sem itens quebrados ou desabilitados nesta rodada.
2. **Nível 2 (Projeto) também só com módulos reais**, agrupados em:
   - `OPERAÇÃO`: Registros Diários, Histórico & Aprovações
   - `GESTÃO` (Gerente only, como hoje): Custos & Ociosidade, Não Conformidades (RNC)
   - `ADMINISTRAÇÃO`: Configurações do Projeto

   Sem grupo "Visão Geral" (não há dashboard nem Mapa Vivo por projeto) e sem
   Histogramas/Medições/EAP/Relatórios (não existem ainda). Os componentes de
   grupo são genéricos — adicionar um item futuro é uma entrada de configuração,
   não uma reestruturação.
3. **Sem modo rail/ícone-colapsável nesta rodada.** Avaliado e descartado: a
   sidebar tem hoje ~7 itens reais no total, e o ganho de espaço de tela do
   modo rail é pequeno nesse tamanho — o padrão (Linear/GitHub) só compensa
   quando a navegação cresce bem além disso. Revisar quando módulos do roadmap
   (Financeiro, Planejamento, Estoque etc.) forem adicionados.
4. **Grupos colapsáveis sem persistência**: estado local (`useState`,
   expandido por padrão), sem `localStorage`. YAGNI — se a falta de persistência
   incomodar no uso real, é uma mudança pequena de adicionar depois.
5. **Project switcher, não link de "voltar pra lista"**: o Project Context
   Card tem um painel de troca rápida de projeto (busca + lista curta +
   link "Ver todos os projetos"), resolvendo a pergunta "como troco de
   projeto?" sem sair da tela atual. Reaproveita a mesma lógica de
   busca-e-filtra que já existe no Topbar (`Buscar projeto…`,
   `MAX_RESULTADOS_BUSCA = 5`) via um hook compartilhado, em vez de duplicá-la.
   O painel usa o mesmo padrão de UI que o Topbar já usa hoje (botão trigger +
   painel posicionado com `absolute` + fecha ao clicar fora via listener de
   `mousedown`) — não o componente `DropdownMenu` do design system: esse
   componente existe no repositório mas não é usado em lugar nenhum hoje, e
   colocar um campo de busca dentro de um Radix `DropdownMenu` é arriscado
   (o menu gerencia foco/teclado por roving-focus + typeahead, o que compete
   com a digitação no input de busca). O padrão do Topbar já é comprovado no
   próprio código e não introduz esse risco.
6. **Botão "Entrar" → "Abrir Projeto"** na listagem de projetos. O card
   continua com botão explícito (não vira um único elemento clicável) —
   já existe um botão de editar (lápis) sobreposto no card, e tornar o card
   inteiro clicável introduziria elementos interativos aninhados/sobrepostos,
   uma armadilha de acessibilidade evitável.
7. **Breadcrumb com nome do projeto automático**: páginas de projeto passam a
   declarar só o trecho final do breadcrumb (ex.:
   `[{ label: 'Custos & Ociosidade' }]`); um hook compartilhado prefixa
   `Projetos > {nome do projeto} >` automaticamente, usando os mesmos dados
   do Project Context Card (cache do React Query dedup a requisição — sem
   chamada duplicada).

## Arquitetura

```
NÍVEL 1 — Empresa (sempre visível)
├─ Dashboard                    /dashboard
└─ Projetos                     /projetos

NÍVEL 2 — Projeto Atual (só quando :projetoId existe na URL)
├─ [Project Context Card + switcher]
│
├─ OPERAÇÃO
│  ├─ Registros Diários         /projetos/:id/registros-diarios
│  └─ Histórico & Aprovações    /projetos/:id/historico-aprovacoes
│
├─ GESTÃO (perfil Gerente)
│  ├─ Custos & Ociosidade       /projetos/:id/custos-ociosidade
│  └─ Não Conformidades (RNC)   /projetos/:id/rncs
│
└─ ADMINISTRAÇÃO
   └─ Configurações do Projeto  /projetos/:id/configuracoes
```

`SidebarNav` continua um único componente — não troca de "personalidade"
quando entra em um projeto, apenas expande: sem `:projetoId`, renderiza só o
Nível 1; com `:projetoId`, injeta o Card + os grupos abaixo. Mesmo princípio
do gate `{projetoId && (...)}` que já existe hoje, só que organizado em
grupos com componentes dedicados em vez de uma lista plana.

## Componentes novos

### `SidebarSection` (`frontend/src/layouts/sidebar/SidebarSection.tsx`)
Título discreto (ex.: "EMPRESA", "OPERAÇÃO") + espaçamento consistente.
Puramente apresentacional, sem estado. Usado tanto para o bloco Nível 1
quanto para cada grupo do Nível 2.

### `SidebarGroup` (`frontend/src/layouts/sidebar/SidebarGroup.tsx`)
Grupo colapsável: título clicável com chevron, `useState<boolean>` local
(expandido por padrão), sem persistência. Recebe `title` e `children`.

### `SidebarNavItem` (`frontend/src/layouts/sidebar/SidebarNavItem.tsx`)
Substitui os `NavLink` inline espalhados em `Sidebar.tsx` hoje. Centraliza a
função `navItemClass` (estado ativo/hover) em um componente reutilizável que
recebe `to`, `icon`, `children`.

### `ProjectContextCard` (`frontend/src/layouts/sidebar/ProjectContextCard.tsx`)
Mostra nome do projeto, nome da empresa, badge de status (reaproveita
`STATUS_BADGE_CLASS`/`STATUS_LABEL`, hoje duplicados só em
`ProjetosListPage.tsx` — movidos para `frontend/src/features/projetos/statusBadge.ts`
compartilhado), execução % (`formatExecucao`, já existe em `lib/format.ts`) e
último RDO (`formatData`). Usa o novo hook `useProjeto(projetoId)`.

Contém o **project switcher**: um botão trigger que abre/fecha um painel
local (`useState<boolean>`, fecha ao clicar fora — mesmo padrão de
`buscaRef`/`handleClickFora` já implementado em `Topbar.tsx`) com:
- campo de busca (reaproveita o hook extraído do Topbar — ver abaixo)
- lista curta dos projetos filtrados (máx. 5, mesmo limite do Topbar hoje)
- rodapé "Ver todos os projetos →" linkando para `/projetos`

### `useProjetoBreadcrumbs` — não é um componente, é um hook
`PageHeader` (`frontend/src/components/ui/page-header.tsx`) é hoje puramente
apresentacional — não importa nada de `features/`. Em vez de dar a ele uma
prop `projetoId` que dispararia um fetch por dentro (quebrando esse
isolamento), um novo hook `useProjetoBreadcrumbs(projetoId, trilhaFinal)` em
`frontend/src/features/projetos/useProjetoBreadcrumbs.ts` monta o array
completo — `Projetos > {nome do projeto} > ...trilhaFinal` — usando
`useProjeto(projetoId)` por baixo. Páginas de projeto chamam o hook e passam
o resultado para o `breadcrumbs` que `PageHeader` já aceita, sem nenhuma
mudança no `PageHeader` em si. Páginas fora de projeto (Dashboard,
ProjetosListPage) continuam como estão, sem usar o hook.

## Camada de dados

### `useProjeto(projetoId)` — novo hook em `frontend/src/features/projetos/projetosApi.ts`
```ts
export function useProjeto(projetoId: string | undefined) {
  return useQuery({
    queryKey: ['projeto', projetoId],
    queryFn: () => apiClient.get<Projeto>(`${PROJETOS_PATH}${projetoId}/`),
    enabled: Boolean(projetoId),
  })
}
```
O endpoint `GET /api/v1/projetos/:id/` já existe no backend
(`ProjetoViewSet` já inclui `RetrieveModelMixin` — `backend/buildflow/projetos/views.py:23-32`),
sem restrição de perfil além de `IsAuthenticatedWithEmpresa` — nenhuma
mudança de backend é necessária. `Sidebar`, `ProjectContextCard` e
`PageHeader` chamam o mesmo hook com o mesmo `projetoId`; o React Query
deduplica a requisição (mesma `queryKey`), então não há chamadas de rede
duplicadas por estarem em componentes diferentes na mesma árvore.

### Hook de busca compartilhado — `useBuscaProjetos` (`frontend/src/features/projetos/useBuscaProjetos.ts`)
Extrai a lógica hoje inline em `Topbar.tsx` (estado do termo, filtro por
`nome`, corte em `MAX_RESULTADOS_BUSCA`) para um hook reutilizável:
```ts
export function useBuscaProjetos(limite = 5) {
  const [termo, setTermo] = useState('')
  const projetos = useProjetos({ enabled: termo.length > 0 })
  const resultados = termo
    ? (projetos.data?.results ?? [])
        .filter((p) => p.nome.toLowerCase().includes(termo.toLowerCase()))
        .slice(0, limite)
    : []
  return { termo, setTermo, resultados }
}
```
Usado tanto pelo `Topbar` (comportamento inalterado, só reimplementado via
hook) quanto pelo dropdown do `ProjectContextCard`.

## Fluxo por página

Nenhuma rota muda. `DashboardLayout` continua montando `Sidebar` + `Topbar` +
`Outlet`. As páginas de projeto (`RegistrosDiariosListPage`,
`HistoricoAprovacoesPage`, `CustosOciosidadePage`, `RncListPage`/`RncFormPage`,
`ConfiguracaoPage`) mudam apenas a chamada ao `PageHeader`:

```tsx
// antes
<PageHeader title="Custos & Ociosidade" breadcrumbs={[{ label: 'Custos & Ociosidade' }]} />

// depois
const breadcrumbs = useProjetoBreadcrumbs(projetoId, [{ label: 'Custos & Ociosidade' }])
// ...
<PageHeader title="Custos & Ociosidade" breadcrumbs={breadcrumbs} />
```

## Fora de escopo

- Modo rail/ícone-colapsável (avaliado, descartado nesta rodada — ver Decisão 3).
- Itens de Nível 1 sem página real: Usuários, Equipes (nível empresa),
  Configurações da Empresa.
- Itens de Nível 2 sem página real: Visão Geral/Dashboard por projeto, Mapa
  Vivo, Histogramas, Medições, EAP, Relatórios.
- Persistência do estado colapsado dos grupos.
- Nova rota, novo endpoint de backend, ou mudança de cor/token do design
  system.
- Tornar o card inteiro da listagem de projetos clicável (mantém botão
  explícito).

## Testes

- **Frontend (e2e)**:
  - Sem `:projetoId` na URL, sidebar mostra só Nível 1 (Dashboard, Projetos),
    sem os grupos de projeto.
  - Com `:projetoId`, sidebar mostra o Project Context Card com nome, status
    e execução corretos, e os 3 grupos com os itens esperados.
  - Perfil Auxiliar não vê os itens do grupo Gestão (Custos, RNC) — mesmo
    gate de perfil que já existe hoje.
  - Breadcrumb de uma página de projeto mostra `Projetos > {nome} > {página}`,
    e o link do nome do projeto leva para `/projetos/:id/registros-diarios`.
  - Project switcher: abrir o dropdown, digitar um termo, ver resultados
    filtrados, clicar em um resultado navega para o projeto certo; link
    "Ver todos os projetos" leva para `/projetos`.
  - `ProjetosListPage`: botão do card diz "Abrir Projeto" (não mais "Entrar").
- **Frontend (unit/hook, se aplicável)**: `useBuscaProjetos` filtra e corta
  corretamente; `useProjeto` não dispara requisição quando `projetoId` é
  `undefined`.
