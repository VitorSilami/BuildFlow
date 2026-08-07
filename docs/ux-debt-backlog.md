# UX Debt Backlog

Data: 2026-08-06
Classificacao: impacto operacional para BuildFlow.

## Critico

| Item | Problema | Evidencia | Recomendacao |
|---|---|---|---|
| UX-001 | EAP aparecia como aba de Configuracoes | `EapPage.tsx`, `ConfiguracaoPage.tsx`, `Sidebar.tsx` | Concluido: "EAP e Cronograma" virou pagina propria em Planejamento. |
| UX-002 | Pesos editaveis sempre e salvamento por blur | `EapDisciplinaCard.tsx` | Criar modo "Editar distribuicao de pesos", salvar/cancelar, total distribuido e diff visual. |
| UX-003 | Gantt insuficiente para decisao operacional | `GanttChart.tsx`, `eap-mobile.png` | Adicionar toolbar, zoom, Hoje, legenda, filtros, baseline, planejado vs realizado e linha de hoje. |
| UX-004 | Sem indicadores de planejamento no topo da EAP | Captura EAP | Mostrar realizado, previsto, desvio e peso distribuido antes do Gantt/tabela. |

## Alto

| Item | Problema | Evidencia | Recomendacao |
|---|---|---|---|
| UX-005 | Estrutura EAP em cards dificulta comparacao | `EapDisciplinaCard.tsx` | Migrar para tabela hierarquica/treegrid com colunas fixas e linhas expansivas. |
| UX-006 | Status visual descentralizado | `format.ts`, status por feature, classes hardcoded | Criar tokens e componente unico de status operacional. |
| UX-007 | App shell trunca contexto do projeto | Sidebar desktop/mobile | Melhorar project switcher, tooltip e largura/colapso da sidebar. |
| UX-008 | Mobile da EAP comprime Gantt | `eap-mobile.png` | Criar modo mobile alternativo: lista cronologica/timeline ou Gantt horizontal com coluna fixa. |
| UX-009 | Falta estado forbidden padronizado | RNCs/Custos usam Alert simples | Criar `ForbiddenState` com motivo e acao de retorno. |
| UX-010 | Filtros operacionais incompletos | EAP, Medicoes, RNCs | Padronizar toolbar com filtros salvos/limpar filtros. |

## Medio

| Item | Problema | Evidencia | Recomendacao |
|---|---|---|---|
| UX-011 | `Card`/`AppCard` e `Alert`/`AppAlert` duplicados | `src/components/ui` | Consolidar API dos componentes. |
| UX-012 | Tabelas sem sorting/filter/pinning | Medicoes, Custos | Introduzir DataTable padronizado antes de telas densas. |
| UX-013 | Error states genericos | varias paginas | Separar erro de rede, API, vazio, permissao e offline. |
| UX-014 | Empty states pouco acionaveis | Dashboard/Projetos/EAP | Incluir acao primaria contextual quando aplicavel. |
| UX-015 | Formularios com inputs nativos locais | Historico, RNC, Custos | Padronizar `DateField`, `MonthField` e mensagens de erro. |
| UX-016 | Sem Storybook/design review isolado | package.json | Adicionar Storybook para componentes base e estados. |
| UX-017 | Cores financeiras e de status hardcoded | Custos, RNC, Gantt | Substituir por tokens semanticos. |

## Baixo

| Item | Problema | Evidencia | Recomendacao |
|---|---|---|---|
| UX-018 | README do frontend ainda e template Vite | `frontend/README.md` | Documentar comandos, arquitetura e padroes do app. |
| UX-019 | Rodape consome espaco em app logado | Screenshots | Avaliar remocao ou versao compacta. |
| UX-020 | Encoding aparece instavel no terminal | leituras via PowerShell | Garantir UTF-8 e editorconfig. |

## Ordem Recomendada de Execucao

1. Criar `docs/user-journeys.md` e `docs/information-architecture.md`. Concluido em 2026-08-06.
2. Consolidar foundation minima do design system. Concluido em 2026-08-06.
3. Redesenhar a EAP como experiencia padrao de planejamento. Concluido em 2026-08-06: a rota `/planejamento/eap` abre diretamente o workspace "EAP e Cronograma", sem flag nem parametro de URL; links antigos de `configuracoes?tab=eap` redirecionam para a rota nova.
4. Cobrir a EAP com Playwright: tabs, expandir/recolher, filtros, modo pesos, validacao 100%, permissoes e snapshots visuais. Parcialmente concluido em 2026-08-06: smoke da EAP padrao, filtros, teclado nas tabs, salvar/cancelar pesos, empty state, criacao de primeira etapa e captura mobile anexada ao relatorio. A suite roda junto com `npm run test:e2e`.
5. Migrar shell e demais telas na ordem: Registros diarios, Historico/Aprovacoes, Medicoes, RNCs, Custos, Dashboard, Configuracoes. Concluido em 2026-08-06 para a primeira passada visual: Registros diarios recebeu KPIs, legenda, painel de dia selecionado, calendario mais estavel, detalhe com producao tabular, painel lateral e fotos com alt descritivo; wizard do RDO recebeu stepper unico responsivo, progresso, metricas por etapa, secoes operacionais, estados vazios e revisao mais clara. Historico/Aprovacoes ganhou fila com filtros, cards de decisao e resumo operacional; Medicoes passou para DataTable e modal padronizado; RNCs recebeu lista priorizada, estado restrito padronizado e resumo no formulario; Custos ganhou KPIs, filtro mensal padronizado e estado restrito; Dashboard ganhou alertas e projetos ativos mais escaneaveis; Configuracoes recebeu KPIs de base e a EAP passou a usar o workspace novo por padrao.

## Riscos de Produto

- Refatorar todas as telas de uma vez pode criar uma interface bonita, mas pior para trabalho repetitivo.
- Trocar a biblioteca do Gantt antes de avaliar requisitos pode aumentar o risco sem resolver o principal: modelo de informacao.
- Padronizar cores sem revisar significado operacional pode mascarar atrasos, riscos e bloqueios.
- Melhorar desktop sem desenhar mobile de campo pode prejudicar engenheiros e responsaveis por RDO.
