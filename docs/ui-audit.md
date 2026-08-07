# BuildFlow UI Audit

Data: 2026-08-06
Escopo: frontend React/Vite em `frontend/`, com foco na tela atual de EAP/Cronograma e nas principais jornadas operacionais.

## Metodo

- Inventario local de `package.json`, rotas, componentes, hooks de API, estilos e testes E2E.
- Captura Playwright com dados mockados, sem backend real, em 1440x900, 1024x768 e 390x844.
- Telas capturadas: dashboard, projetos, EAP, registros diarios, historico/aprovacoes, medicoes, RNCs, custos/ociosidade e configuracoes.
- Evidencias salvas em `docs/ui-audit-screenshots/`.

## Validacao Executada

- `npm run lint`: passou com avisos preexistentes de Fast Refresh e uma dependencia ausente no `useEffect` de `Topbar`.
- `npm run test`: passou, mas nao ha testes unitarios encontrados pelo Vitest.
- `npm run test:e2e`: passou, 67 testes Playwright.
- Captura Playwright temporaria da auditoria: passou e gerou 27 screenshots; o spec temporario foi removido.
- `npm run build`: passou apos a foundation corrigir o formatter do Tooltip em `src/features/custos-ociosidade/CustoCompositionDonutChart.tsx`.

## Resumo Executivo

O produto ja tem uma base tecnica promissora: React 19, Vite, TypeScript, Tailwind 4, Radix UI, Lucide, TanStack Query, Recharts e Playwright. As fontes recomendadas pelo diagnostico tambem ja estao instaladas e aplicadas via tokens (`Inter`, `Space Grotesk`, `JetBrains Mono`).

O maior problema nao e falta de biblioteca. E falta de uma camada de produto/operacao acima dos componentes: as paginas tem bons blocos isolados, mas ainda nao articulam status, prioridade, excecoes, proximas acoes e densidade informacional como uma ferramenta diaria para obra rodoviaria.

A tela EAP hoje esta semanticamente subordinada a "Configuracoes", embora seja uma jornada principal de planejamento. O Gantt existe, mas funciona como visualizacao simples de barras, sem toolbar, legenda, filtros, baseline, caminho critico, coluna fixa, zoom ou modo explicito de edicao. Os pesos ficam editaveis o tempo todo e salvam no `onBlur`, o que aumenta risco operacional.

## Evidencias Visuais

Capturas principais:

- Dashboard: `docs/ui-audit-screenshots/dashboard-desktop.png`, `dashboard-tablet.png`, `dashboard-mobile.png`
- Projetos: `docs/ui-audit-screenshots/projetos-desktop.png`, `projetos-tablet.png`, `projetos-mobile.png`
- EAP: `docs/ui-audit-screenshots/eap-desktop.png`, `eap-tablet.png`, `eap-mobile.png`
- Registros diarios: `docs/ui-audit-screenshots/registros-diarios-desktop.png`, `registros-diarios-tablet.png`, `registros-diarios-mobile.png`
- Historico e aprovacoes: `docs/ui-audit-screenshots/historico-aprovacoes-desktop.png`, `historico-aprovacoes-tablet.png`, `historico-aprovacoes-mobile.png`
- Medicoes: `docs/ui-audit-screenshots/medicoes-desktop.png`, `medicoes-tablet.png`, `medicoes-mobile.png`
- RNCs: `docs/ui-audit-screenshots/rncs-desktop.png`, `rncs-tablet.png`, `rncs-mobile.png`
- Custos e ociosidade: `docs/ui-audit-screenshots/custos-ociosidade-desktop.png`, `custos-ociosidade-tablet.png`, `custos-ociosidade-mobile.png`
- Configuracoes: `docs/ui-audit-screenshots/configuracoes-desktop.png`, `configuracoes-tablet.png`, `configuracoes-mobile.png`

## Stack Encontrada

- Framework: React 19 com Vite 8 e TypeScript 6.
- Rotas: `react-router-dom` 7.
- Estado remoto: `@tanstack/react-query`.
- UI base: componentes locais em `src/components/ui`, com primitives Radix para dialog, dropdown, select, tabs, toast, tooltip, sheet, checkbox, switch e avatar.
- Estilizacao: Tailwind CSS 4 com tokens em `src/app.css`.
- Icones: `lucide-react`.
- Graficos: `recharts`.
- Testes: Vitest, Testing Library e Playwright.
- Form schemas: `zod` em projetos/RDO.

## Pontos Fortes

- Estrutura de app shell consistente: `DashboardLayout`, `Sidebar`, `Topbar` e `PageHeader`.
- Componentes UI locais seguem uma direcao shadcn/Radix, o que facilita padronizacao sem dependencia visual fechada.
- Skeleton, empty state, error retry, badges, progress, tabelas e cards ja existem.
- Sidebar tem comportamento por perfil e projeto aberto.
- As telas operacionais ja cobrem loading e error state em boa parte das queries.
- Suite Playwright existente cobre fluxos importantes: login, navegacao, projetos, EAP, medicoes, RDO, RNC e custos.

## Problemas Criticos

1. **EAP e cronograma estao dentro de Configuracoes**

   Evidencia: `src/pages/ConfiguracaoPage.tsx` renderiza a aba `EAP`; a captura `eap-desktop.png` mostra titulo principal "Configuracoes". Para o usuario, planejamento fisico fica visualmente tratado como administracao, nao como jornada operacional central.

2. **Edicao de peso salva no `onBlur` sem modo explicito**

   Evidencia: `src/features/configuracoes/EapDisciplinaCard.tsx` chama `salvarPesoDisciplina` no blur do input. Isso cria risco de alteracao acidental e nao oferece total distribuido em modo de edicao, cancelar, salvar lote ou destaque de mudancas nao salvas.

3. **Gantt nao atende a leitura operacional esperada**

   Evidencia: `src/features/configuracoes/GanttChart.tsx` usa Recharts para barras por data, mas nao possui toolbar, zoom, filtro, legenda, baseline, dependencias, caminho critico ou coluna de atividades fixa. No mobile (`eap-mobile.png`), os labels e o eixo temporal ficam comprimidos.

4. **Estados por cor nao formam uma linguagem semantica unica**

   Evidencia: ha cores hardcoded em `src/lib/format.ts`, `GanttChart.tsx`, `RncFormPage.tsx`, `CustosOciosidadePage.tsx` e componentes de status. Verde representa sucesso, progresso e decoracao; vermelho/amber aparecem em classes diretas em varias telas.

## Problemas de Alto Impacto

- App shell ocupa uma faixa lateral fixa de 256px no desktop, mas o nome do projeto continua truncado em `ProjectContextCard`; a informacao mais importante do contexto fica parcialmente escondida.
- A pagina EAP nao mostra indicadores de planejamento no topo: avanco realizado, previsto, desvio e peso distribuido.
- O botao "Ocultar cronograma" esta visualmente promovido demais como primario e nao indica que controla uma secao expansivel.
- A estrutura EAP em cards altos prejudica comparacao. Uma tabela hierarquica ou treegrid daria melhor densidade e escaneabilidade.
- Progresso e status ficam distantes do nome da etapa quando a tela alarga.
- Mobile existe, mas algumas telas mantem densidade e componentes de desktop sem uma estrategia clara de priorizacao.
- Alguns headings e breadcrumbs usam `font-mono` uppercase com espacamento alto; em nomes longos, isso reduz legibilidade operacional.

## Problemas Medios

- `PageHeader` existe, mas e usado sem subtitulo em varias telas. Falta texto curto de intencao operacional.
- Dashboard tem boa estrutura visual, mas aparece mais polido que fluxos frequentes; isso pode puxar a migracao para a tela errada.
- Tabelas ainda sao simples, sem padrao de ordenacao, filtros, colunas fixas ou densidade ajustavel.
- Formularios misturam componentes UI (`FormField`, `SelectField`) com inputs nativos estilizados localmente.
- Error states sao genericos e nao diferenciam falha de permissao, rede, vazio operacional e API indisponivel.
- Empty states existem, mas raramente oferecem proxima acao contextual.

## Problemas Baixos

- README do frontend ainda e o template Vite.
- Ha uma pasta `dist/`, `playwright-report/` e `test-results/` no workspace; conferir se devem ficar fora do controle de versao.
- Algumas strings nos arquivos aparecem com problemas de encoding quando lidas no terminal; verificar codificacao UTF-8 consistente.
- O rodape ocupa espaco vertical em telas operacionais e pode ser dispensavel dentro do app logado.

## Acessibilidade

- Pontos positivos: uso frequente de elementos nativos, `aria-label` em varios botoes, Radix para dialogs/sheets/selects/tabs, skeleton com `sr-only`.
- Riscos: Gantt em SVG/Recharts nao tem alternativa tabular equivalente na mesma secao; status dependem bastante de cor; alguns controles visuais nao comunicam estado de expansao/edicao de forma completa; foco visivel depende dos componentes base, mas precisa ser verificado manualmente em cada jornada.
- Recomendacao: incluir axe/Playwright em rotas criticas e validar teclado para sidebar, project switcher, tabs, Gantt, tabela EAP, modal de importacao, RDO wizard e fluxos de aprovacao.

## Recomendada Proxima Etapa

Executar a Etapa 2 antes de redesenhar: documentar jornadas reais por perfil e transformar a EAP em tela-piloto. A primeira implementacao de UI deve ficar atras de `VITE_NEW_BUILD_FLOW_UI=true` para reduzir risco de regressao em producao.
