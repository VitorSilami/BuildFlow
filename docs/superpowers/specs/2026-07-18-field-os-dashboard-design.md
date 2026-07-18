# BuildFlow "Field OS" — Dashboard, Projetos, RDO Wizard, Configurações

## Contexto

Depois de migrar o frontend para Tailwind CSS v4 + shadcn/ui (Design System v2), o usuário rodou o
prompt de "Product Discovery" (que escrevi para o Lovable) e recebeu de volta 4 telas mockadas —
Dashboard, Projetos, RDO (wizard), Configurações — sob o nome "BuildFlow Field OS". Este documento
formaliza uma auditoria de UX/UI dessas telas contra o BuildFlow real e o design resultante,
cobrindo tanto mudanças puramente visuais quanto extensões reais de schema/backend que essas
telas exigem (a auditoria completa, com citações a Nielsen/Fitts/Hick/Gestalt/JTBD, foi
apresentada na conversa e não é repetida aqui — este documento é a especificação do que será
construído, não a crítica em si).

## Decisões

1. **`Projeto` ganha 4 campos novos** (migration real): `numero_contrato` (texto, opcional),
   `trecho` (texto, opcional — ex.: "km 120-185"), `engenheiro_responsavel` (texto livre, opcional
   — deliberadamente NÃO uma FK para não acoplar a um usuário cadastrado no sistema, já que nem
   todo engenheiro responsável por uma obra precisa ter login no BuildFlow), `status` (choices
   `ativo` | `pausado` | `concluido`, default `ativo`).
2. **`% Execução` é calculado, nunca inventado.** Por projeto: média ponderada (peso =
   `MetaMensal.peso_percentual`) do avanço de cada disciplina, onde avanço da disciplina =
   `soma(ProducaoDiaria.quantidade)` (somando só produções cuja `unidade` bate com a `unidade` da
   `MetaMensal` daquela disciplina — evita somar m² com m³) dividido por `MetaMensal.valor_alvo`.
   Disciplinas sem `peso_percentual` definido não entram na média ponderada. Se nenhuma disciplina
   do projeto tem peso definido (ou não há metas), o resultado é `null` — o frontend exibe "—", não
   "0%", para nunca sugerir que existe um número real quando não existe.
3. **Novo endpoint `GET /api/dashboard/`**, escopado por empresa (isolamento multitenant, Princípio
   I): retorna contagem de projetos por status, execução média dos projetos ativos, a lista desses
   projetos (id/nome/status/execução), e "alertas" — projetos ativos sem nenhum RDO nos últimos 7
   dias corridos (constante nomeada, ajustável).
4. **RDO vira wizard real**: 6 passos (Gerais, Produção, Equipe, Máquinas, Ocorrências, Fotos),
   navegação Anterior/Próximo, um passo visível por vez (em vez do formulário único atual).
   Validação Zod continua sendo avaliada no submit final (não por passo, para não introduzir
   comportamento novo de validação incremental sem necessidade).
5. **"Duplicar dia anterior"**: busca o RDO mais recente do projeto (mesmo endpoint de listagem já
   existente, pegando o primeiro item — a listagem já vem ordenada por data decrescente) e
   pré-preenche Equipe e Fiscal (campos que tendem a se repetir de um dia para o outro). Turno e
   Clima **não** são pré-preenchidos automaticamente (mudam dia a dia, diferente de equipe/fiscal).
   Produção/Presenças/Máquinas/Ocorrências continuam em branco — duplicar dados operacionais do dia
   anterior seria uma fonte real de erro (RNC), não uma conveniência.
6. **Turno e Clima como grupos de botões**, não `<select>`/`SelectField` — aplicando Fitts's Law
   (alvos maiores, mais fáceis de acertar em campo/sob sol/com luva) sobre um conjunto pequeno e
   fixo de opções (2 e 4 respectivamente).
7. **Configurações vira abas** (Disciplinas/Metas/Equipes/Custos) em vez de 4 `Card`s empilhados,
   com um seletor de projeto explícito no topo da página (a página já é por-projeto hoje via rota,
   isso só torna visível qual projeto está sendo configurado).
8. **Sidebar ganha agrupamento** ("OPERAÇÃO" como rótulo acima dos 3 itens existentes — Dashboard
   se torna o 4º item, primeiro da lista) e a marca ganha o subtítulo "FIELD OS". Topbar ganha um
   campo de busca — **client-side apenas**, filtrando os projetos já carregados na sessão (sem
   endpoint de busca cross-entidade nesta rodada — RDOs/equipes ficam de fora da busca por ora).

## Arquitetura

### Backend

- `backend/buildflow/projetos/models.py`: adicionar os 4 campos + migration.
- `backend/buildflow/projetos/serializers.py`: `ProjetoSerializer` ganha os 4 campos (todos
  opcionais no create/update) + um `SerializerMethodField` `execucao_percentual` (read-only,
  `Decimal | None`).
- Novo módulo `backend/buildflow/projetos/services.py` (ou local equivalente já usado por outras
  apps, seguir o padrão de `registros_diarios/services.py` se existir) com a função pura de cálculo
  de execução, testável isoladamente sem precisar de request/view.
- O endpoint de dashboard vira uma view dentro de `projetos/views.py` (`DashboardView`, rota
  `GET /api/dashboard/`), sem app nova — é uma única rota agregadora, a maior parte do dado já vem
  de `Projeto`, e criar um domínio próprio para isso agora seria over-engineering (YAGNI).
- Testes: `backend/buildflow/projetos/tests/test_execucao.py` (cálculo puro, sem DB real quando
  possível) e `test_dashboard.py` (endpoint, isolamento multitenant obrigatório).

### Frontend

- `frontend/src/pages/DashboardPage.tsx` (novo) + rota `/dashboard` em `App.tsx`, e vira o destino
  pós-login (`ProtectedRoute`/redirect de `/` aponta pra cá em vez de `/projetos`).
- `frontend/src/features/dashboard/dashboardApi.ts` (novo, hook `useDashboard()` via TanStack
  Query, mesmo padrão dos outros hooks de API já existentes).
- `frontend/src/pages/ProjetosListPage.tsx`: cards redesenhados (status, contrato, trecho,
  engenheiro, execução), tabs de filtro.
- `frontend/src/features/projetos/ProjetoForm.tsx`: campos novos (todos opcionais) no formulário de
  criação.
- `frontend/src/pages/RdoPage.tsx`: reestruturado como wizard — provavelmente split em
  sub-componentes por passo (arquivo já está em ~500 linhas, crescer mais sem separar violaria a
  diretriz de tamanho de arquivo do usuário).
- `frontend/src/pages/ConfiguracaoPage.tsx`: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` do
  shadcn (já portado, Task 2 do Design System v2) em vez de `Card`s empilhados.
- `frontend/src/layouts/Sidebar.tsx`/`Topbar.tsx`: grupo "OPERAÇÃO", subtítulo "FIELD OS", campo de
  busca client-side.

## Testes

- Backend: TDD conforme convenção do projeto — cálculo de execução testado com casos de borda
  (sem meta, meta sem peso, unidades divergentes, múltiplas disciplinas); endpoint de dashboard
  testado com isolamento multitenant (empresa A não vê dado de empresa B).
- Frontend: E2E existentes (`projetos.spec.ts`, `rdo.spec.ts`, `config.spec.ts`) precisam continuar
  passando — como os testes usam nomes/ids de campo existentes, a reestruturação (wizard, tabs)
  exige atualizar os specs para navegar pelos novos passos/abas, mantendo as mesmas asserções de
  fundo (o que é testado não muda, só como se chega até lá). Novo spec `dashboard.spec.ts` para o
  Dashboard.

## Fora de escopo

- Notificações reais (o sino do Topbar é só visual).
- Busca cross-entidade real (índice de busca, backend de busca) — só filtro client-side sobre
  projetos já carregados.
- RNC, Medição, Custos & Ociosidade, Mapa Vivo — módulos futuros do Product Blueprint, não tocados
  aqui.
- Diferenciação de permissão por papel (Cluster A/B/C/D do blueprint) — Dashboard é visível a
  qualquer usuário autenticado por enquanto, sem filtro por papel.
