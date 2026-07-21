---

description: "Task list for feature 001-mvp-gestao-diaria"
---

# Tasks: MVP Gestão Diária de Obras (Multitenant)

**Input**: Design documents from `/specs/001-mvp-gestao-diaria/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Incluídos — o Princípio V da constituição ("Testes Automatizados Obrigatórios") exige teste de
isolamento multitenant e de autenticação antes de qualquer feature ser considerada pronta; portanto testes
não são opcionais nesta lista.

**Organization**: Tarefas agrupadas por história de usuário (spec.md), permitindo implementação e teste
independentes de cada uma.

## Path Conventions

Web app conforme `plan.md`: `backend/buildflow/<app>/...` (Django) e `frontend/src/...` (React+TS).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Gerar esqueleto do backend com `cookiecutter-django` em `backend/` usando as flags decididas em
      research.md (`rest_api=DRF`, `frontend_pipeline=None`, `use_docker=n`, `use_celery=n`, `use_sentry=n`,
      `use_whitenoise=n`, `use_async=n`, `use_mailpit=n`)
- [X] T002 Remover `templates/` (exceto o exigido pelo allauth headless) e `webpack/` do scaffold gerado em
      `backend/`
- [X] T003 [P] Criar `.env.example` com variáveis de DB, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `SECRET_KEY` na raiz do projeto
- [X] T004 [P] Configurar lint/format do backend (ruff/black) em `backend/pyproject.toml`
- [X] T005 [P] Configurar `pytest-django` + `factory_boy` em `backend/requirements/local.txt` e
      `backend/setup.cfg`/`pyproject.toml`
- [X] T006 [P] Criar app frontend React+TypeScript (Vite) em `frontend/` com estrutura de
      `src/{app,pages,components,features,hooks,services,schemas,types,routes}`
- [X] T007 [P] Configurar lint/format do frontend (ESLint/Prettier) em `frontend/.eslintrc`, `frontend/.prettierrc`
- [X] T008 [P] Configurar Vitest + React Testing Library e Playwright em `frontend/vitest.config.ts`,
      `frontend/playwright.config.ts`

**Checkpoint**: projeto instalável e rodável (mesmo sem features) antes de seguir.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: nenhuma história de usuário pode começar antes desta fase estar completa.

- [X] T009 Criar model `Empresa` em `backend/buildflow/empresas/models.py` (nome, slug, is_active, timestamps)
- [X] T010 Criar custom user model `Usuario` em `backend/buildflow/usuarios/models.py` (nome, email único, empresa
      FK obrigatória, perfil enum, is_active) e configurar `AUTH_USER_MODEL` em
      `backend/config/settings/base.py`
- [X] T011 Configurar `django-allauth` em modo headless com apenas o provider Google habilitado em
      `backend/config/settings/base.py` (`INSTALLED_APPS`, `SOCIALACCOUNT_PROVIDERS`)
- [X] T012 Implementar `SocialAccountAdapter` que recusa login quando usuário não existe, está inativo, sem
      empresa, ou token de audiência/emissor inválidos, em `backend/buildflow/usuarios/adapters.py`
- [X] T013 [P] Implementar `TenantScopedQuerySet`/`TenantScopedManager` e `TenantScopedViewSetMixin`
      (filtra por `request.user.empresa`, força `empresa`/`projeto` no `perform_create`) em
      `backend/buildflow/core/querysets.py` e `backend/buildflow/core/permissions.py`
- [X] T014 [P] Configurar cookies de sessão `HttpOnly`, `Secure`, `SameSite=Lax` em
      `backend/config/settings/base.py`
- [X] T015 [P] Configurar DRF + `drf-spectacular` (paginação, versionamento `/api/v1/`, schema OpenAPI) em
      `backend/config/settings/base.py`
- [X] T016 [P] Implementar cliente HTTP centralizado com tratamento global de 401 em
      `frontend/src/services/apiClient.ts`
- [X] T017 [P] Implementar `AuthContext`/hook de autenticação e wrapper de rota protegida em
      `frontend/src/features/auth/` e `frontend/src/routes/ProtectedRoute.tsx`
- [X] T018 [P] Criar factories de teste (`EmpresaFactory`, `UsuarioFactory` para 2 empresas distintas) em
      `backend/buildflow/core/tests/factories.py`
- [X] T019 Gerar e aplicar migrations iniciais (`Empresa`, `Usuario`, `Projeto`, `Disciplina`/`Unidade`/
      `CatalogoServico`/`MotivoParada`) em `backend/buildflow/*/migrations/`. Role/DB Postgres local
      (`buildflow`) criados com aprovação do usuário; migrations aplicadas com sucesso
      (`manage.py migrate`).
- [X] T020 [P] Models de apoio compartilhados `Disciplina`, `Unidade`, `CatalogoServico`, `MotivoParada` em
      `backend/buildflow/configuracoes/models.py`. **Correção descoberta na implementação**: `Disciplina`/
      `CatalogoServico` têm FK obrigatória para `Projeto`, então o model `Projeto` (originalmente US3/T036)
      foi adiantado para esta fase em `backend/buildflow/projetos/models.py` — sem isso T020 não seria
      implementável antes de US3, reproduzindo o mesmo problema de ordenação já corrigido para Pessoa/
      Máquina no `/speckit-analyze`. Ver nota em plan.md.

**Checkpoint**: fundação pronta — histórias de usuário podem começar.

---

## Phase 3: User Story 1 - Provisionamento de empresas e usuários (Priority: P1) 🎯 MVP

**Goal**: administrador cria empresa e usuários (Gerente/Auxiliar) pelo Django Admin, com regras de
integridade aplicadas.

**Independent Test**: pelo Admin, criar uma empresa e um usuário Gerente ativo vinculado a ela; confirmar
persistência sem depender de nenhuma outra funcionalidade.

### Tests for User Story 1

- [X] T021 [P] [US1] Teste: criação de empresa e busca por nome no Admin em
      `backend/buildflow/empresas/tests/test_admin.py`
- [X] T022 [P] [US1] Teste: criação de `Usuario` sem empresa MUST falhar em
      `backend/buildflow/usuarios/tests/test_models.py`
- [X] T023 [P] [US1] Teste: perfil fora do enum é rejeitado em `backend/buildflow/usuarios/tests/test_models.py`

### Implementation for User Story 1

- [X] T024 [US1] Registrar `Empresa` no Django Admin com busca por nome e filtro por `is_active` em
      `backend/buildflow/empresas/admin.py`
- [X] T025 [US1] Registrar `Usuario` no Django Admin com filtros por empresa/perfil/ativo em
      `backend/buildflow/usuarios/admin.py`

**Verificado**: `uv run pytest` — 32/32 testes passando (incl. todos os testes herdados/corrigidos do
scaffold do cookiecutter-django em `buildflow/usuarios/tests/`), `ruff check`/`ruff format` limpos,
`manage.py check` sem issues, migrations aplicadas.

**Checkpoint**: História 1 funcional e testável de forma independente.

---

## Phase 4: User Story 2 - Login com Google restrito à própria empresa (Priority: P1)

**Goal**: usuário ativo autentica via Google e recebe sessão restrita à própria empresa; usuário inválido é
recusado.

**Independent Test**: completar login com usuário seed ativo → acessa listagem de projetos da empresa
correta; repetir com e-mail não cadastrado/usuário inativo/sem empresa → recusado.

### Tests for User Story 2

- [X] T026 [P] [US2] Contract test: login aceito para usuário ativo vinculado a empresa em
      `backend/buildflow/usuarios/tests/test_auth_api.py`
- [X] T027 [P] [US2] Contract test: login recusado (e-mail não cadastrado / inativo / sem empresa / token
      inválido) em `backend/buildflow/usuarios/tests/test_auth_api.py`
- [X] T028 [P] [US2] E2E test: fluxo completo login → listagem → logout → redirecionamento em
      `frontend/tests/e2e/login.spec.ts`

### Implementation for User Story 2

- [X] T029 [US2] **Correção pós-design**: em vez de um endpoint custom `POST /api/v1/auth/google/`,
      usa-se o endpoint nativo do `django-allauth` headless `POST /_allauth/browser/v1/auth/provider/token`
      — reaproveita a verificação de ID token (assinatura/emissor/audiência/expiração) já implementada e
      testada pela lib, em vez de reimplementá-la. `HeadlessAdapter` customizado em
      `backend/buildflow/usuarios/adapters.py` injeta nome/perfil/empresa na resposta. Ver contracts/api.md
      e research.md.
- [X] T030 [US2] Endpoints de sessão/logout: `GET`/`DELETE /_allauth/browser/v1/auth/session` (nativos do
      allauth headless, mesma correção do T029)
- [X] T031 [US2] `LoginPage` com botão "Entrar com Google" (Google Identity Services), estados de
      carregamento/erro em `frontend/src/pages/LoginPage.tsx`
- [X] T032 [US2] Lógica de redirecionamento (autenticado→interna, não autenticado→login) no
      `AuthContext`/`ProtectedRoute`/`PublicOnlyRoute` em `frontend/src/features/auth/AuthContext.tsx` e
      `frontend/src/routes/ProtectedRoute.tsx`

**Verificado**: `uv run pytest` — 38/38 (backend), `npx playwright test tests/e2e/login.spec.ts` — 3/3
(frontend), `ruff check`/`format` e `tsc --noEmit` limpos, `manage.py check`/migrations OK.

**Checkpoint**: Histórias 1 e 2 funcionam de forma independente e combinada.

---

## Phase 5: User Story 3 - Gestão de projetos da empresa (Priority: P2)

**Goal**: usuário lista e cria projetos restritos à própria empresa.

**Independent Test**: criar projeto autenticado como Empresa A; confirmar visibilidade só para Empresa A e
404 ao tentar acessar por URL direta como Empresa B.

### Tests for User Story 3

- [X] T033 [P] [US3] Contract test: listar/criar projeto respeita empresa do usuário em
      `backend/buildflow/projetos/tests/test_api.py`
- [X] T034 [P] [US3] Isolation test: usuário da Empresa A não lista/acessa/edita projeto da Empresa B em
      `backend/buildflow/projetos/tests/test_isolation.py`
- [X] T035 [P] [US3] E2E test: criar projeto e ver na listagem em `frontend/tests/e2e/projetos.spec.ts`

### Implementation for User Story 3

- [X] T036 [P] [US3] Model `Projeto` (empresa, nome, descricao, criado_por, timestamps) em
      `backend/buildflow/projetos/models.py` — implementado na fase Foundational (T020), ver nota lá
- [X] T037 [US3] `ProjetoSerializer` com `fields` explícitos, sem `empresa` gravável, em
      `backend/buildflow/projetos/serializers.py`
- [X] T038 [US3] `ProjetoViewSet` usando `TenantScopedViewSetMixin` em `backend/buildflow/projetos/views.py`
      (depende de T013, T036, T037)
- [X] T039 [US3] `ProjetosListPage` com estados de carregamento/vazio/erro em
      `frontend/src/pages/ProjetosListPage.tsx`
- [X] T040 [US3] Formulário de criação de projeto com validação (nome obrigatório, não só espaços) em
      `frontend/src/features/projetos/ProjetoForm.tsx`

**Verificado**: `uv run pytest` — 47/47 (backend), `npx playwright test tests/e2e/` — 5/5 (frontend, incl.
login), `ruff check`/`format` e `tsc --noEmit` limpos. Anônimo recebe 403 (não 401) nos endpoints
`/api/v1/*` — comportamento padrão do DRF com `SessionAuthentication` sem desafio `WWW-Authenticate`;
`apiClient.ts` trata 401 e 403 da mesma forma (sessão inválida). Documentado em contracts/api.md.

**Checkpoint**: Histórias 1–3 funcionam de forma independente e combinada.

---

## Phase 6: User Story 4 - Registro diário de obra (RDO) (Priority: P3)

**Goal**: usuário cria e visualiza RDOs completos (produção, presença, máquinas, ocorrências, fotos) de um
projeto da própria empresa.

**Independent Test**: dentro de um projeto existente, criar um RDO completo e confirmar listagem/detalhe;
confirmar isolamento cross-tenant.

### Tests for User Story 4

- [X] T041 [P] [US4] Contract test: criar RDO completo com sub-recursos aninhados em
      `backend/buildflow/registros_diarios/tests/test_api.py`
- [X] T042 [P] [US4] Teste: `motivo_parada` obrigatório apenas quando `horas_paradas > 0` em
      `backend/buildflow/registros_diarios/tests/test_validations.py`
- [X] T043 [P] [US4] Teste: presença/máquina aceita vínculo com cadastro OU lançamento avulso, nunca ambos
      vazios, em `backend/buildflow/registros_diarios/tests/test_validations.py`
- [X] T044 [P] [US4] Isolation test: RDO de projeto de outra empresa não é criável/visível em
      `backend/buildflow/registros_diarios/tests/test_isolation.py`
- [X] T045 [P] [US4] E2E test: preencher wizard completo de RDO (incl. foto) em
      `frontend/tests/e2e/rdo.spec.ts`

### Implementation for User Story 4

- [X] T046 [P] [US4] Models `RegistroDiario`, `ProducaoDiaria`, `Presenca`, `ApontamentoMaquina`,
      `Ocorrencia`, `Foto` em `backend/buildflow/registros_diarios/models.py`. **Correção pós-design**:
      `Equipe`/`Pessoa`/`Maquina` (originalmente US5) também tiveram que ser adiantadas para
      `backend/buildflow/configuracoes/models.py` — `Presenca`/`ApontamentoMaquina` referenciam Pessoa/
      Maquina como FK opcional (cadastro OU avulso), mesma razão de Projeto/Disciplina terem sido
      adiantados no Foundational. `Maquina.equipe` tornado obrigatório (não nullable como em data-model.md)
      — nulo quebraria `tenant_path`, e o "pool sem equipe" não é essencial (avulso no RDO já cobre).
      **Bug real corrigido**: nenhum model novo (Disciplina/Equipe/Pessoa/Maquina/RDO/etc.) tinha
      `objects = TenantScopedManager()` — só `tenant_path` — então `.for_empresa()` falhava com
      `AttributeError`. Adicionado em todos.
- [X] T047 [US4] Serializers aninhados graváveis (produções/presenças/máquinas/ocorrências) em
      `backend/buildflow/registros_diarios/serializers.py`; fotos tratadas como upload multipart separado
      (`FotoSerializer`/`FotoUploadView`), não aninhado no JSON de criação do RDO.
- [X] T048 [US4] `RegistroDiarioService` (regra de `motivo_parada` condicional, cálculo de eficiência de
      máquina via `@property`, validação de tipo/tamanho de arquivo de foto) em
      `backend/buildflow/registros_diarios/services.py`
- [X] T049 [US4] Views/rotas: `/api/v1/projetos/{id}/registros-diarios/` (list/create), rota plana
      `/api/v1/registros-diarios/{id}/` (detail, conforme contracts/api.md) e
      `/api/v1/registros-diarios/{id}/fotos/` (upload), em `backend/buildflow/registros_diarios/views.py`.
      **Dependência extra não prevista**: a UI de RDO precisa listar disciplinas/serviços/unidades/equipes
      antes de US5 (CRUD de configuração) existir — criado um endpoint somente-leitura
      `GET /api/v1/projetos/{id}/configuracao-rdo/` em `backend/buildflow/configuracoes/views.py` só para
      isso; US5 ainda implementará criação/edição.
- [X] T050 [US4] `RdoPage` com seções gerais/produção/equipe/máquinas/ocorrências (arrays dinâmicos,
      add/remove), validação Zod espelhando as regras do backend, em `frontend/src/pages/RdoPage.tsx`
- [X] T051 [US4] Upload de foto com preview e km opcional em
      `frontend/src/features/registros-diarios/FotoUpload.tsx`

**Verificado**: `uv run pytest` — 61/61 (backend), `npx playwright test tests/e2e/` — 6/6 (frontend),
`ruff check`/`format` e `tsc --noEmit` limpos, `manage.py check`/migrations OK.

**Bugs reais encontrados em teste manual (2026-07-17), corrigidos após o MVP "completo"**:
1. Campo "Fiscal" na `RdoPage` exigia digitar um ID numérico de usuário sem nenhuma forma de descobri-lo
   na UI — sempre retornava 400. Corrigido: `ConfiguracaoRdoView` agora retorna `fiscais` (usuários ativos
   da empresa) e o campo virou um `<select>`, pré-preenchido com o próprio usuário autenticado.
2. Ao digitar um nome avulso em Presença/Máquina e depois trocar para uma pessoa/máquina cadastrada, o
   campo avulso não era limpo — os dois ficavam preenchidos, violando a regra "cadastro OU avulso, nunca
   os dois" tanto no frontend (Zod) quanto no backend (`CheckConstraint`). Corrigido nos `onChange` dos
   seletores; teste de regressão E2E adicionado em `rdo.spec.ts`.
3. `CORS_URLS_REGEX` só cobria `/api/`, não `/_allauth/` — o login real (fora dos testes mockados) seria
   bloqueado pelo navegador por falta de cabeçalhos CORS na rota de sessão/login. Corrigido (ver T063).
4. **Lacuna real, não só bug**: FR-023 exige listar/visualizar RDOs, mas nenhuma tela consumia os hooks
   `useRegistrosDiarios`/`useRegistroDiario` já existentes — só a tela de criação existia. Depois de criado,
   o RDO ficava só no banco/Admin, sem nenhuma forma de vê-lo pela UI. Criadas
   `RegistrosDiariosListPage` e `RegistroDiarioDetailPage` (rotas
   `/projetos/:projetoId/registros-diarios` e `/projetos/:projetoId/registros-diarios/:registroId`);
   `RdoPage` agora redireciona para o detalhe após salvar (em vez de uma mensagem solta). Testes E2E
   novos em `registros-list.spec.ts`.

5. `DJANGO_READ_DOT_ENV_FILE=True` precisava ser exportado manualmente em todo terminal novo antes de
   rodar `manage.py` — esquecer isso fazia o Django cair no `DATABASE_URL` padrão (sem credenciais) e
   falhar a conexão com o Postgres (`fe_sendauth: no password supplied`). Corrigido: `base.py` agora lê
   o `.env` automaticamente sempre que o arquivo existir, sem exigir a flag — variáveis de ambiente reais
   continuam tendo precedência, e em produção normalmente não há `.env` no container (no-op seguro).
   `README.md`/`quickstart.md` atualizados.

**Verificado após as correções**: 10/10 E2E, `70/70 pytest`, `ruff`/`tsc`/`oxlint` limpos.

**Checkpoint**: Histórias 1–4 funcionam de forma independente e combinada.

**Refatoração do frontend com design system Mazer (2026-07-17)**: o frontend não tinha nenhuma camada de
layout nem biblioteca de componentes — cada página montava seu próprio HTML/CSS inline. Adotado o design
system [Mazer](https://github.com/zuramai/mazer) (Bootstrap 5 + SCSS, tema claro/escuro) via
`frontend/src/styles/`, com nova camada `frontend/src/layouts/` (Sidebar/Topbar/Footer/DashboardLayout/
AuthLayout) e `frontend/src/components/ui/` (Card/Alert/PageHeader/FormField/Spinner). Todas as páginas
(Login, Projetos, Registros Diários, RDO, Configurações) foram reescritas para usar essas camadas, sem
nenhuma mudança de lógica de negócio, hooks, API ou rotas. Spec e plano em
`docs/superpowers/specs/2026-07-17-frontend-mazer-refactor-design.md` e
`docs/superpowers/plans/2026-07-17-frontend-mazer-refactor.md`. Bug real encontrado durante a execução: o
`vitest.config.ts` não excluía `tests/e2e/**`, então `npm run test` capturava os specs do Playwright e
falhava com "Playwright Test did not expect test() to be called here" — bug pré-existente desde antes
desta refatoração, corrigido junto (`exclude`/`passWithNoTests` em `vitest.config.ts`).

**Verificado após a refatoração**: 10/10 E2E, `tsc -b --noEmit`/`oxlint`/`npm run build` limpos.

---

## Phase 7: User Story 5 - Configurações do projeto (Priority: P3)

**Goal**: usuário cria e visualiza metas, equipes (pessoas/máquinas) e valores de custo de um projeto da
própria empresa; RDOs passam a poder referenciar esses cadastros.

**Independent Test**: cadastrar meta + equipe com pessoas/máquinas; confirmar que aparecem na Configuração e
podem ser referenciados ao criar um RDO (integração com História 4); confirmar isolamento cross-tenant.

### Tests for User Story 5

- [X] T052 [P] [US5] Contract test: criar/editar meta, equipe, pessoa, máquina, valor de custo em
      `backend/buildflow/configuracoes/tests/test_api.py`
- [X] T053 [P] [US5] Isolation test: configuração de projeto de outra empresa não é acessível/editável em
      `backend/buildflow/configuracoes/tests/test_isolation.py`
- [X] T054 [P] [US5] E2E test: criar configuração (disciplina/equipe) em `frontend/tests/e2e/config.spec.ts`
      — o uso no RDO já é coberto por `rdo.spec.ts` (mesmos dados vindos de `configuracao-rdo`)

### Implementation for User Story 5

- [X] T055 [P] [US5] Models `MetaMensal` (renomeado de `Meta` para não colidir com `Model.Meta` do Django),
      `ValorCusto` em `backend/buildflow/configuracoes/models.py` — `Equipe`/`Pessoa`/`Maquina` já existiam
      (adiantados no Foundational/US4, ver notas lá)
- [X] T056 [US5] Serializers + `soma_pesos_disciplinas()` (informativa, não bloqueante — retornada no GET
      agregado, não valida no POST) em `backend/buildflow/configuracoes/serializers.py` e `services.py`
- [X] T057 [US5] Views/rotas de configuração: `GET /api/v1/projetos/{id}/configuracao/` (agregado),
      CRUD de disciplinas/equipes/pessoas/máquinas/metas/valores em
      `backend/buildflow/configuracoes/views.py` + `urls.py`
- [X] T058 [US5] `ConfiguracaoPage` (disciplinas/metas/equipes/valores) com estado vazio/carregamento/erro
      e formulários de criação em `frontend/src/pages/ConfiguracaoPage.tsx`
- [X] T059 [US5] Seletor de pessoa/máquina cadastrada (com opção avulso) no `RdoPage` — já implementado em
      US4 via `useConfiguracaoRdo`, consistente com os cadastros agora geridos em `ConfiguracaoPage`

**Verificado**: `uv run pytest` — 70/70 (backend), `npx playwright test tests/e2e/` — 7/7 (frontend),
`ruff check`/`format` e `tsc --noEmit` limpos, `manage.py check`/migrations OK.

**Checkpoint**: todas as 5 histórias funcionam de forma independente e combinada.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T060 [P] Management command `seed_demo_data` (2 empresas, 1 Gerente + 1 Auxiliar por empresa, 2
      projetos por empresa, RDOs e configurações de exemplo) em
      `backend/buildflow/core/management/commands/seed_demo_data.py` — testado e idempotente
      (`get_or_create` em tudo, sub-recursos só na primeira criação do projeto)
- [X] T061 [P] Management command `seed_legacy_data` (importa `BASE_QTD_L2` da planilha
      `MODELO IMPORT SOFT` como Disciplina/CatalogoServico/MetaMensal de um projeto de demonstração) em
      `backend/buildflow/core/management/commands/seed_legacy_data.py`. Adicionado `openpyxl` como
      dependência de dev (só usado neste comando de seed, não em runtime de produção). Testado contra a
      planilha real: 11 disciplinas, 23 serviços, 11 metas importadas corretamente, isoladas por projeto
      (constraint `projeto+nome` respeitada mesmo com "Terraplenagem" existindo em outros projetos demo)
- [X] T062 [P] Schema/documentação OpenAPI (`/api/schema/`, `/api/docs/`) via `drf-spectacular` — já
      configurado desde o Foundational, confirmado funcionando (`test_openapi.py`)
- [X] T063 Revisão de segurança: mass assignment, CORS, headers de segurança, mensagens de erro sem
      vazamento de dados de outra empresa (Princípio III). Checklist:
      - Mass assignment: OK — todos os serializers com `fields` explícitos; `empresa`/`projeto`/
        `criado_por`/`autor` sempre via `perform_create`, nunca do payload (testado em US3/US5)
      - **Bug real encontrado e corrigido**: `CORS_URLS_REGEX` só cobria `/api/.*`, mas o login
        (`allauth` headless) vive em `/_allauth/.*` — sem CORS nesse path, o navegador bloquearia a
        resposta cross-origin da SPA e o login nunca funcionaria de verdade fora de testes mockados.
        Corrigido para `^/(api|_allauth)/.*$` em `backend/config/settings/base.py`, verificado
        manualmente (header `Access-Control-Allow-Origin` presente nas duas rotas)
      - Headers de segurança de produção (HSTS, SSL redirect, cookies seguros, nosniff): já
        configurados pelo scaffold do cookiecutter-django em `config/settings/production.py`, não
        alterados
      - Vazamento cross-tenant: confirmado 404 (nunca 403/detalhe) em todos os testes de isolamento
        (projetos, RDO, configuração)
- [X] T064 Rodar `quickstart.md` ponta a ponta e registrar resultado. **Cobertura real: 95%** (`coverage
      run -m pytest` + `coverage report`, 959 statements, 46 missed), acima dos 80% exigidos pela
      constituição. Migrations/seeds/admin/API verificados manualmente contra o Postgres local real
      (não só testes automatizados). **Não executado manualmente**: login Google real (exige Client
      ID/Secret reais — usuário decidiu testar isso por conta própria depois, ver conversa)
- [X] T065 [P] README de onboarding local (setup, seeds, comandos de teste) na raiz do projeto

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende de Setup — BLOQUEIA todas as histórias
- **User Stories (Phase 3–7)**: todas dependem de Foundational; ordem sugerida por prioridade
  (US1 → US2 → US3 → US4 → US5), mas US3/US4/US5 são implementáveis em paralelo por times diferentes após
  US1+US2 (login) estarem prontos, já que cada uma toca arquivos próprios
- **Polish (Phase 8)**: depende das histórias que se quer entregar

### User Story Dependencies

- **US1 (P1)**: sem dependência de outra história — base de dados via Django Admin
- **US2 (P1)**: depende de US1 (precisa de usuário provisionado para logar)
- **US3 (P2)**: depende de US2 (precisa de sessão autenticada); não depende de US4/US5
- **US4 (P3)**: depende de US3 (precisa de projeto existente) e de T020 (Foundational: Disciplina/Unidade/
  CatalogoServico, obrigatórios em `ProducaoDiaria`); referencia cadastros de Pessoa/Máquina de US5, mas
  funciona com lançamento avulso mesmo sem US5 pronta (Clarification: presença/máquina aceita avulso)
- **US5 (P3)**: depende de US3 (precisa de projeto existente); T059 integra com US4 mas não bloqueia o
  restante de US5

### Parallel Opportunities

- Todas as tarefas `[P]` de uma mesma fase podem rodar em paralelo (arquivos distintos, sem dependência)
- Após Foundational, US3, US4 (exceto T059) e US5 (exceto T059) podem ser trabalhadas em paralelo por
  desenvolvedores diferentes

---

## Parallel Example: User Story 4

```bash
# Testes de US4 em paralelo:
Task: "Contract test criar RDO completo em backend/buildflow/registros_diarios/tests/test_api.py"
Task: "Teste motivo_parada condicional em backend/buildflow/registros_diarios/tests/test_validations.py"
Task: "Isolation test RDO cross-tenant em backend/buildflow/registros_diarios/tests/test_isolation.py"
Task: "E2E test wizard de RDO em frontend/tests/e2e/rdo.spec.ts"

# Models de US4 em paralelo (mesmo arquivo — na prática sequencial dentro do arquivo, mas sem dependência
# de outra tarefa para começar):
Task: "Models RegistroDiario/ProducaoDiaria/Presenca/ApontamentoMaquina/Ocorrencia/Foto"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Completar Setup e Foundational
2. Completar US1 (provisionamento) e US2 (login) — sem isso nada mais é demonstrável
3. **Parar e validar**: provisionar empresa/usuário, logar, confirmar isolamento básico de sessão
4. Esse é o menor incremento útil e testável (login funcionando é o gate de segurança de tudo depois)

### Incremental Delivery

1. Setup + Foundational → fundação pronta
2. US1 + US2 → login funcionando → validar
3. US3 (projetos) → validar isolamento cross-tenant → demo
4. US4 (RDO) → validar → demo
5. US5 (configurações) → validar integração com US4 → demo
6. Polish → seeds, documentação, revisão de segurança final

### Parallel Team Strategy

Após Foundational + US1 + US2 prontos: um desenvolvedor em US3, outro em US5 (cadastros), um terceiro
começa US4 usando lançamento avulso (sem esperar US5) e integra o seletor de cadastro (T059) quando US5
estiver pronta.

---

**Backend do "Field OS" (2026-07-18)**: `Projeto` ganha `numero_contrato`, `trecho`,
`engenheiro_responsavel` e `status` (todos opcionais, migration `0003`). Novo
`calcular_execucao_percentual` (`buildflow/projetos/services.py`) computa `% execução` a partir de
`MetaMensal.peso_percentual` x `ProducaoDiaria.quantidade` real — nunca inventado, retorna `None`
quando não há base de cálculo. Novo endpoint `GET /api/v1/dashboard/` agrega projetos por status,
execução média e alertas de RDO atrasado (>7 dias). Frontend consumidor fica para um plano
separado (`docs/superpowers/plans/2026-07-18-field-os-frontend.md`, quando escrito).

**Verificado**: suíte pytest completa + ruff limpos.

**Frontend do "Field OS" — Dashboard (2026-07-19)**: nova `DashboardPage` consumindo
`GET /api/v1/dashboard/` (contagens por status, execução média, projetos ativos, alertas de RDO
atrasado). `/dashboard` vira o destino pós-login (era `/projetos`). Sidebar ganha o Dashboard como
primeiro item, agrupamento "Operação" para os itens existentes, e subtítulo "Field OS" na marca.
Topbar ganha busca client-side de projetos (reaproveitando o cache de `useProjetos()`, sem
endpoint novo, com fetch lazy — só dispara ao digitar, evitando uma requisição em toda página
autenticada). Próximos passos do redesign "Field OS" (Projetos, RDO wizard, Configurações) ficam
em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend do "Field OS" — Projetos (2026-07-19)**: `ProjetoForm` ganha `numero_contrato`,
`trecho`, `engenheiro_responsavel` e `status` (todos opcionais, `status` default "Ativo").
`ProjetosListPage` reescrita: cards mostram status (badge), contrato, trecho, engenheiro e
execução (`formatExecucao`, extraído para `lib/format.ts` e compartilhado com `DashboardPage`),
com um filtro por status (Todos/Ativos/Pausados/Concluídos) client-side sobre a lista já
carregada. Sem endpoint novo — não há ainda edição de projeto (`ProjetoViewSet` só suporta
list/create/retrieve), então o status só pode ser definido na criação. Próximos passos do
redesign "Field OS" (RDO wizard, Configurações) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Backend do "Field OS" — Edição de Projetos (2026-07-19)**: `ProjetoViewSet` ganha
`UpdateModelMixin` (`PATCH`/`PUT /api/v1/projetos/{id}/`), aceitando os mesmos campos já graváveis
na criação (`criado_por` protegido via `read_only_fields`, `empresa` protegida por omissão do
próprio `Meta.fields` do serializer — nenhum dos dois é aceito do payload do cliente; isolamento
multitenant automático via `TenantScopedViewSetMixin`). Novo campo `ultimo_rdo_data` no
`ProjetoSerializer` (data do RDO mais recente do projeto, ou `null`) — a busca de "último RDO",
antes inline em `DashboardView`, foi extraída para `obter_ultima_data_rdo()` em
`projetos/services.py` e reaproveitada nos dois lugares. Sem migration nova. Frontend consumidor
fica para um plano separado (`docs/superpowers/plans/2026-07-19-field-os-frontend-projetos-v2.md`,
quando escrito).

**Verificado**: suíte pytest completa (93/93) + ruff limpos.

**Frontend do "Field OS" — Edição de Projetos e Redesign de Cards (2026-07-19)**: `ProjetoForm`
generalizado para criar e editar (prop `projeto?`, hook `useAtualizarProjeto` via `PATCH`); criação
e edição agora abrem em modal (`Dialog`, primeiro consumo no codebase) em vez do card inline
anterior. Cards de `ProjetosListPage` redesenhados: ícones em trecho/engenheiro/último RDO (novo
campo `ultimo_rdo_data`), badge de status com cores semânticas reais (verde/âmbar/cinza), barra de
execução via `Progress` (primeiro consumo) — mostrada só quando há dado real, nunca uma barra em 0%
para "sem dado". Nova busca em texto (nome/trecho/engenheiro) somada aos tabs de status já
existentes, tudo client-side sobre a lista já carregada. Sidebar/Topbar ganham `sticky`. Próximos
passos do redesign "Field OS" (RDO wizard, Configurações) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend do "Field OS" — Wizard de RDO (2026-07-19)**: `RdoPage` reescrita como wizard de 6
passos (Gerais/Produção/Equipe/Máquinas/Ocorrências/Revisão), navegação Anterior/Próximo, cada
passo extraído para seu próprio componente em `features/registros-diarios/wizard/`. Turno e Clima
viram grupos de botões (`GrupoBotoes`) em vez de dropdowns — alvos maiores, mais fáceis de acertar
em campo. "Duplicar dia anterior" busca o RDO mais recente do projeto (mesmo endpoint de listagem
já existente) e pré-preenche apenas Equipe e Fiscal — nunca turno/clima/produção/presenças/
máquinas/ocorrências, que mudam dia a dia. Validação Zod continua avaliada só no submit final (não
por passo). O passo "Revisão" é informativo, não um upload real — fotos continuam sendo anexadas
na tela de detalhe pós-criação (`FotoUpload`/`useEnviarFoto`), já que o registro precisa existir no
backend antes de aceitar fotos; essa decisão foi confirmada com o usuário antes de escrever este
plano. Próximo passo do redesign "Field OS" (Configurações) fica em plano separado.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Backend do "Field OS" — Conclusão (2026-07-21)**: `GET /api/v1/dashboard/` ganha `atividade_rdo`
(contagem de RDOs por dia, últimos 7 dias, dias sem registro aparecem com `quantidade: 0` — o
gráfico de barras do frontend não pode "pular" dia). `GET /api/v1/projetos/{id}/registros-diarios/`
ganha filtro opcional `?mes=YYYY-MM`: quando presente, filtra por mês e retorna uma lista plana sem
paginação (formato de resposta muda de `{count, next, previous, results}` para um array simples só
nesse caso — usado pelo calendário de RDOs do frontend); formato inválido retorna 400. Sem o
parâmetro, comportamento e formato de resposta atuais ficam intactos.

**Verificado**: suíte pytest completa + ruff limpos.

**Frontend do "Field OS" — Dashboard com gráficos (2026-07-21)**: `DashboardPage` ganha 2 gráficos
Recharts (nova dependência) — barra de "RDOs por dia" (últimos 7 dias, `atividade_rdo` do backend)
e donut de distribuição de status (ativos/pausados/concluídos, mesmas cores semânticas dos badges
de projeto), mais barra de execução "semáforo" (vermelho <30%/âmbar 30–70%/verde >70%) na lista de
projetos ativos e ícones nas tiles de resumo e nos alertas. `Progress` ganha prop opcional
`indicatorClassName` para permitir a cor por faixa sem duplicar o componente.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend do "Field OS" — Calendário de RDOs (2026-07-21)**: `RegistrosDiariosListPage` substitui
a lista simples por uma grade de calendário mensal (`CalendarioMensal`, matemática de `Date`
nativo, sem lib de calendário). Cada dia mostra quantos RDOs existem; clique num dia vazio cria um
RDO com a data pré-preenchida (`RdoPage` agora lê `?data=YYYY-MM-DD` da URL), clique num dia com 1
RDO vai direto pro detalhe, clique num dia com 2+ RDOs (diurno + noturno no mesmo dia, por exemplo)
abre uma lista inline pra escolher qual. `useRegistrosDiarios` ganha parâmetro opcional `mes`
consumindo o filtro `?mes=` do backend, normalizando a resposta pro mesmo formato `{ results }` já
usado no resto do app.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend do "Field OS" — Configurações em abas (2026-07-21)**: `ConfiguracaoPage` reorganizada de
4 `Card`s empilhados para `Tabs` (Disciplinas / Metas / Equipes / Valores) — reduz rolagem, zero
mudança de lógica de negócio, handlers ou validação. Encerra o redesign "Field OS" iniciado em
`2026-07-18-field-os-dashboard-design.md`.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend — Piloto de identidade visual no Dashboard (2026-07-21)**: `Card` ganha prop opcional
`eyebrow` (label mono-caps acima do título, aditivo — zero mudança pros 20+ consumidores
existentes). `DashboardPage` ganha tratamento visual reaproveitado da `LoginPage`/`Sidebar`: tiles
de resumo viram caixas com borda tracejada + label mono-caps (mesmo padrão da seção "facts" do
mockup do login), eyebrows mono-caps nos cards de gráfico, textura `grid-blueprint` sutil
(opacidade 10%) atrás do cabeçalho da página, acento `signal` no eyebrow do gráfico "RDOs por dia".
Puramente apresentação — nenhuma mudança de dado ou lógica. Piloto: se a direção validar, estende
pras outras telas autenticadas (Calendário, Configurações, Projetos, Wizard de RDO) numa iniciativa
separada.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend — Polish SaaS profissional, Onda 1 (2026-07-21)**: primeira onda do polimento
inspirado em Linear/Notion/Spotify/Google/Microsoft — tokens de motion (`--duration-fast`,
`--duration-base`, `--ease-emphasized`) aplicados ao `Button` (feedback de hover/press
consistente, ausente até então), e skeleton loaders (componente shadcn já existente mas nunca
adotado) substituindo o spinner genérico nas 6 telas de carregamento de página (Dashboard,
Projetos, Calendário de RDOs, Configurações, Wizard de RDO, Detalhe de RDO) — sensação de "quase
pronto" em vez de espera genérica. `LoginPage` mantém `Spinner` (feedback inline do botão de
login, não carregamento de página). Próximas ondas (redução de ruído visual, sistema de
feedback/toast, UI otimista) ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.

**Frontend — Polish SaaS profissional, Onda 2 (2026-07-21)**: segunda onda do polimento — `EmptyState`
ganha ícone/título opcionais (aditivo, retrocompatível com os 5 usos que continuam só texto),
aplicado aos 3 empty states "de página" (Dashboard, 2 na listagem de Projetos); botão de editar
projeto (ícone de lápis) fica oculto por padrão e aparece no hover/foco do card (`Card` ganha a
classe `group/card`), reduzindo ruído visual nas listas — mesma lógica do Notion de esconder ação
secundária até o usuário precisar dela. Próximas ondas (sistema de feedback/toast, UI otimista)
ficam em planos separados.

**Verificado**: build + lint limpos, suíte E2E completa passando.
