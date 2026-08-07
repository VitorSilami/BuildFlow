# Component Inventory

Data: 2026-08-06
Escopo: `frontend/src`

## Dependencias de UI

| Necessidade | Encontrado | Observacao |
|---|---|---|
| Componentes base | Componentes locais em `src/components/ui` | Padrao compativel com shadcn/ui, sem Storybook encontrado. |
| Primitivos acessiveis | Radix UI | Dialog, dropdown, select, tabs, toast, tooltip, sheet, checkbox, switch e avatar. |
| Estilizacao | Tailwind CSS 4 | Tokens centralizados em `src/app.css`. |
| Icones | Lucide | Usado em layout, paginas, status e acoes. |
| Tabelas | Componente local `table.tsx` | Nao ha TanStack Table; tabelas sao estaticas. |
| Graficos | Recharts | Usado para dashboard, custos, aprovacoes, carta de controle e Gantt. |
| Formularios | Inputs locais + Zod em alguns fluxos | Nao ha React Hook Form. |
| Testes visuais/E2E | Playwright | Suite existente em `frontend/tests/e2e`. |
| Storybook | Nao encontrado | Lacuna para design system e a11y visual. |

## Tokens e Tema

Arquivo principal: `frontend/src/app.css`

- Fontes: `Inter`, `Space Grotesk`, `JetBrains Mono`.
- Tokens: background, foreground, surface, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, ink, signal.
- Tema claro e escuro por classe `.dark`.
- Radius base: `0.5rem`.
- Utilitario decorativo: `grid-blueprint`.

Lacunas:

- Ainda nao existem tokens semanticos para estados operacionais: success, warning, danger, info, delayed, blocked, critical path, planned, actual, baseline.
- Cores de estado aparecem como Tailwind hardcoded (`red`, `amber`, `emerald`, `cyan`, `slate`) em varios arquivos.
- `font-display` aplica letter spacing negativo no CSS; a direcao do produto pede evitar letter spacing negativo em UI compacta.

## Componentes UI Locais

Pasta: `frontend/src/components/ui`

| Componente | Status | Observacao |
|---|---|---|
| `button.tsx` | Base presente | Variantes e tamanhos disponiveis. |
| `input.tsx` | Base presente | Usado diretamente em muitos formularios. |
| `textarea.tsx` | Base presente | Usado em rejeicoes e RDO. |
| `select.tsx` | Radix presente | Boa base para select acessivel. |
| `select-field.tsx` | Wrapper presente | Padrao ainda separado de `FormField`. |
| `checkbox.tsx` | Radix presente | Base OK. |
| `switch.tsx` | Radix presente | Base OK. |
| `tabs.tsx` | Radix presente | Usado em projetos e configuracoes. |
| `dialog.tsx` | Radix presente | Usado em projeto/modal. |
| `sheet.tsx` | Radix presente | Usado no menu mobile. |
| `dropdown-menu.tsx` | Radix presente | Base disponivel. |
| `tooltip.tsx` | Radix presente | Base disponivel. |
| `toast.tsx` / `toaster.tsx` | Radix/custom presente | Feedback global existe. |
| `table.tsx` | Base presente | Sem sorting/filter/pinning. |
| `card.tsx` e `app-card.tsx` | Duplicacao provavel | Dois conceitos de card coexistem. |
| `alert.tsx` e `app-alert.tsx` | Duplicacao provavel | Dois alerts com nomes diferentes. |
| `app-stat-card.tsx` | Presente | Bom bloco para KPIs, mas ainda usa tones hardcoded. |
| `app-status-badge.tsx` e `badge.tsx` | Duplicacao parcial | Badge generico e badge operacional coexistem. |
| `empty-state.tsx` | Presente | Precisa padrao com acao contextual. |
| `error-retry.tsx` | Presente | Mensagens genericas. |
| `skeleton.tsx` | Presente | Usado em paginas. |
| `page-header.tsx` | Presente | Deve virar padrao de pagina com subtitulo e acoes. |
| `progress.tsx` | Presente | Usado para execucao/eficiencia. |
| `grupo-botoes.tsx` | Presente | Parece controle segmentado, avaliar convergencia com Tabs. |
| `photo-upload-button.tsx` | Base presente | Fluxo especifico de fotos/RDO; agora com descricao opcional, foco visivel e layout consistente para camera/galeria. |
| `icon-button.tsx` | Criado | Botao iconico com label obrigatorio e tooltip. |
| `data-table.tsx` | Criado | Tabela tipada simples com empty state padronizado. |
| `app-state.tsx` | Criado | Loading, error, forbidden e empty filtrado padronizados. |
| `confirm-dialog.tsx` | Criado | Confirmacao explicita para acoes sensiveis. |

## Componentes de Feature

### Dashboard

- `DashboardPage.tsx`: visao executiva com KPIs, alertas de RDO, distribuicao de aprovacao, progresso por disciplina e projetos ativos.
- Alertas e projetos ativos foram reorganizados para leitura rapida, com hierarquia mais clara e links de acao por frente/projeto.

Riscos:

- Ainda nao ha drill-down contextual a partir dos graficos.
- Ranking, tendencias e comparacao entre periodos dependem de dados historicos mais consistentes.

### Planejamento / EAP

- `EapPage.tsx`: pagina propria de Planejamento para EAP e Cronograma, carregando configuracao do projeto, unidades de RDO e breadcrumbs de planejamento.
- `EapWorkspace.tsx`: experiencia padrao de EAP e Cronograma, com KPIs, tabs internas, toolbar, tabela hierarquica, editor detalhado, Gantt e modo explicito de pesos.
- `GanttChart.tsx`: Gantt simples via Recharts.
- `EapDisciplinaCard.tsx`: arvore recursiva por cards, inputs de peso e servicos.
- `ImportarEapButton.tsx`: importacao de planilha.
- `CartaControleChart.tsx`: produtividade diaria em servicos.

### Configuracoes

- `ConfiguracaoPage.tsx`: pagina agregadora de disciplinas, equipes e valores, com KPIs de base para disciplinas, servicos, equipes e recursos.

Riscos:

- EAP mistura visualizacao, edicao, validacao, criacao de subdisciplina e servico no mesmo componente.
- O componente recursivo tende a crescer em complexidade conforme forem adicionados filtros, permissao, modo peso, dependencias e baseline.
- Gantt e EAP nao compartilham modelo visual comum de status/periodo.

### Registros Diarios

- `RegistrosDiariosListPage.tsx`: visao mensal migrada para a foundation, com KPIs do mes, legenda de status e painel lateral de dia selecionado.
- `RegistroDiarioDetailPage.tsx`: detalhe migrado para a foundation, com KPIs, dados do turno, producao tabular, equipe/maquinas em painel lateral e fotos com alt descritivo.
- `CalendarioMensal.tsx`: calendario operacional.
- `RdoPage.tsx` + `wizard/*`: wizard de criacao do RDO migrado para uma estrutura visual comum, com stepper unico responsivo, progresso, metricas por etapa, secoes operacionais, estados vazios e remocao de linhas antes do envio.
- `FotoUpload.tsx` e `RdoStepFotos.tsx`: anexos de fotos com preview, nome/tamanho, km por imagem, remocao antes do envio e resumo de pendencias por km.
- `HistoricoAprovacoesPage.tsx`: fila de aprovacao migrada para a foundation, com KPIs, filtros, cards expansivos, decisao explicita e motivo de rejeicao.
- `AprovacaoDonutChart.tsx`: distribuicao de status.
- `FotoUpload.tsx`, `climaIcons.tsx`, `statusRegistroBadge.ts`.

Riscos:

- Wizard tem muitos subcomponentes com estados de formulario manuais.
- Wizard agora compartilha hierarquia visual, mas ainda precisa de validacao por etapa antes de avancar e revisao mobile em campo.
- Mobile e uso em campo precisam de validacao especifica, principalmente fotos, selecao de equipe e apontamentos.

### Projetos

- `ProjetosListPage.tsx`, `ProjetoForm.tsx`, `useBuscaProjetos.ts`, `useProjetoBreadcrumbs.ts`, `statusBadge.ts`.

Riscos:

- Cards de projeto sao bons para poucos itens, mas podem perder eficiencia com muitos projetos.
- Botao de editar fica oculto ate hover/foco; no touch isso precisa ser validado.

### RNC, Medicoes, Custos

- RNC: `RncListPage.tsx`, `RncFormPage.tsx`, `AdicionarAcaoCorretivaForm.tsx`; lista com KPIs, filtros por pendencia/conclusao, status efetivo e estado restrito padronizado.
- Medicoes: `MedicoesListPage.tsx`, `MedicaoDetailPage.tsx`, `NovaMedicaoModal.tsx`; lista e detalhe migrados para DataTable, KPIs, resumo financeiro e modal com campos padronizados.
- Custos: `CustosOciosidadePage.tsx`, `CustoCompositionDonutChart.tsx`; pagina com KPIs de perdas, filtro mensal padronizado, composicao visual e estado restrito padronizado.

Riscos:

- Exportacao, filtros salvos e comparacao historica ainda nao foram desenhados.
- Cores financeiras e de risco ainda aparecem em pontos locais e podem virar tokens semanticos.

## Duplicacoes e Inconsistencias

- `Card` e `AppCard` coexistem.
- `Alert` e `AppAlert` coexistem.
- `Badge` e `AppStatusBadge` coexistem.
- Alguns formularios complexos ainda usam selects e textareas locais; datas e mes de referencia ja foram movidos para `Input`/`FormField` nas telas migradas.
- Status/tone sao definidos por feature (`statusBadge.ts`, `statusRegistroBadge.ts`, `statusMedicaoBadge.ts`, `statusEfetivoBadge.ts`) sem contrato visual central.

## Recomendacao

Para a proxima evolucao da EAP, consolidar uma camada pequena de design system:

- `PageHeader` com breadcrumb, titulo, descricao e acoes.
- `StatusBadge` unico com tokens semanticos.
- `StatCard` unico.
- `DataTable` ou `TreeTable` para listas operacionais.
- `Field`, `DateField`, `SelectField` e mensagens de erro padronizadas.
- `EmptyState`, `ErrorState`, `ForbiddenState` e `LoadingState` com API consistente.

## Foundation Criada

Detalhes da foundation estao em `docs/design-system-foundation.md`.
