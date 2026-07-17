# Phase 0 Research: MVP Gestão Diária de Obras

Todos os itens de Technical Context foram preenchidos com decisão direta (nenhum `NEEDS CLARIFICATION`
restante). Este documento registra a justificativa de cada decisão técnica não trivial e as alternativas
consideradas, para rastreabilidade (Princípio VI da constituição).

## 1. Estratégia de sessão/autenticação para SPA + Google OAuth

**Decision**: Sessão Django autenticada via `django-allauth` em **modo headless**, com cookie de sessão
`HttpOnly`, `Secure`, `SameSite=Lax`. O frontend React usa o Google Identity Services para obter as
credenciais do usuário e as envia para o endpoint headless de login social do allauth; o backend valida o
token com o Google, cria/associa a sessão e devolve o cookie.

**Rationale**: Cookies `HttpOnly` não são acessíveis via JavaScript, eliminando roubo de token por XSS —
requisito explícito do spec (seção de segurança) e do Princípio III da constituição. `django-allauth` já
vem parcialmente configurado pelo `cookiecutter-django` (seção `SOCIALACCOUNT_ADAPTER`), reduzindo trabalho
de validar emissor/audiência/expiração/e-mail verificado manualmente — a lib já faz essa validação.

**Alternatives considered**:
- **JWT em `localStorage`**: rejeitado — exposto a XSS, e o próprio spec/constituição pedem justificativa
  forte para evitar `localStorage` com tokens sensíveis, que não existe aqui.
- **JWT em cookie `HttpOnly`** (ex. `djangorestframework-simplejwt` + cookie manual): viável, mas duplica
  lógica que o `django-allauth` (já presente no scaffold) resolve nativamente para login social; adicionaria
  complexidade sem benefício claro (viola Princípio IV/YAGNI).
- **Verificação manual do ID token do Google** (sem allauth, endpoint DRF customizado): mais controle, mas
  reimplementa validação de emissor/audiência/expiração que o allauth já oferece — descartado por
  duplicação de esforço e maior superfície de erro de segurança.

**Confirmado na implementação (US2)**: os endpoints reais usados são os nativos do `django-allauth`
headless (client `browser`): `POST /_allauth/browser/v1/auth/provider/token` (login), `GET`/
`DELETE /_allauth/browser/v1/auth/session` (sessão atual/logout) — em vez de endpoints custom
`/api/v1/auth/*` desenhados inicialmente no `contracts/api.md`. `SOCIALACCOUNT_ONLY=True` desabilita
qualquer login por senha. `HeadlessAdapter` customizado
(`backend/buildflow/usuarios/adapters.py`) injeta `nome`/`perfil`/`empresa`/`empresa_nome` na resposta,
que por padrão só traria campos genéricos do allauth. Exigiu adicionar `pyjwt[crypto]` como dependência
(usado internamente pelo provider do Google para decodificar o ID token).

## 2. Isolamento multitenant a nível de aplicação

**Decision**: Shared database, shared schema. Um `TenantScopedQuerySet`/`Manager` reutilizável em
`apps/core/querysets.py` filtra automaticamente por `empresa` a partir do usuário da requisição; todas as
views herdam de uma `TenantScopedViewSetMixin` que aplica esse filtro no `get_queryset()` e força `empresa`
no `perform_create()`, ignorando qualquer valor de empresa enviado no payload.

**Rationale**: O spec exige isolamento total sem introduzir banco/schema por tenant nesta fase (explicitado
na seção de arquitetura do brief original). Um mixin/manager centralizado evita que a regra de isolamento
seja reimplementada (e potencialmente esquecida) em cada view — uma única fonte de verdade testável.

**Alternatives considered**:
- **Schema-per-tenant (django-tenants)**: mais isolamento físico, mas adiciona complexidade operacional
  (migrations por schema, roteamento de conexão) desproporcional à escala declarada (dezenas de empresas,
  volume baixo) — violaria YAGNI.
- **Filtro manual em cada view**: rejeitado — alto risco de um desenvolvedor esquecer o filtro em uma nova
  view, quebrando o Princípio I silenciosamente.

## 3. Armazenamento de fotos do RDO

**Decision**: `FileField`/`ImageField` do Django com `MEDIA_ROOT` local em desenvolvimento; camada de
`Storage` do Django mantida pluggável (sem hard-code de caminho) para permitir troca por um backend de objeto
compatível com S3 em produção, quando necessário.

**Rationale**: Atende ao requisito funcional (FR-022) sem introduzir uma dependência de infraestrutura de
nuvem antes de haver necessidade real — YAGNI. A abstração de `Storage` do próprio Django já viabiliza a
troca futura sem reescrever código de aplicação.

**Alternatives considered**:
- **Integração direta com S3/GCS desde já**: rejeitado nesta fase — nenhum provedor de nuvem foi confirmado
  como necessário, e adicionar credenciais/infra de nuvem sem uso real viola Princípio IV.

## 4. Bootstrap do backend com cookiecutter-django

**Decision**: Gerar o projeto com `rest_api=DRF`, `frontend_pipeline=None`, `use_docker=n`, `use_celery=n`,
`use_sentry=n`, `use_whitenoise=n`, `use_async=n`, `use_mailpit=n`; remover `templates/` (exceto o que o
allauth headless eventualmente exigir) e `webpack/` após a geração.

**Rationale**: Já avaliado e aprovado em conversa anterior — o gerador entrega custom user model, DRF +
drf-spectacular, django-environ e settings segregados por ambiente prontos, evitando reescrever esse
boilerplate, sem herdar infraestrutura (Docker/Celery/multi-cloud) que o projeto não precisa agora.

**Alternatives considered**: Escrever o projeto Django do zero — descartado por ser estritamente mais
trabalho para o mesmo resultado, sem ganho de simplicidade.

## 5. Frameworks de teste

**Decision**: Backend — `pytest` + `pytest-django` + `factory_boy` (fixtures realistas de Empresa/Usuário/
Projeto) + `rest_framework.test.APITestCase` para os testes de contrato/isolamento. Frontend — `Vitest` +
`React Testing Library` para unit/integration, `Playwright` para os fluxos E2E do spec (login, criar
projeto, criar RDO, isolamento cross-tenant).

**Rationale**: Pilha padrão de mercado para Django+DRF e React+TS, com bom suporte a fixtures/factories que
facilitam os testes de isolamento multitenant exigidos pelo Princípio V.

**Alternatives considered**: `unittest` puro (mais verboso, sem fixtures de factory); Cypress no lugar de
Playwright (equivalente, Playwright escolhido por suporte nativo a múltiplos contextos de navegador — útil
para simular duas sessões de empresas diferentes no mesmo teste E2E de isolamento).

## 6. Client de dados no frontend

**Decision**: TanStack Query para cache/estado remoto; Zod para validação de schema dos formulários,
espelhando os contratos de `contracts/api.md`.

**Rationale**: Evita estado de loading/erro/cache reimplementado manualmente em cada tela (requisito de UX
do spec: FR-027/FR-028); Zod dá validação de frontend tipada e alinhada ao contrato da API.

**Alternatives considered**: Redux Toolkit + RTK Query — mais boilerplate para o escopo do MVP; estado
remoto simples com `useEffect`/`useState` manual — descartado por não cobrir cache/retry/estados de forma
consistente (violaria a exigência de estados de carregamento/erro uniformes).

## 7. Correção descoberta na implementação: versão do pytest

**Decision**: Fixar `pytest==8.4.2` no `pyproject.toml` (em vez de `9.1.1`, resolvido inicialmente pelo
`cookiecutter-django`).

**Rationale**: `pytest 9.1.1` apresentou um erro interno reproduzível (`assert not self._finalizers` em
`_pytest/fixtures.py`) ao rodar qualquer teste que dependesse do fixture `db`/`django_db` do
`pytest-django==4.12.0` — falha em 100% dos testes, incluindo os testes nativos do próprio scaffold do
`cookiecutter-django` (não relacionada a nenhum código escrito neste projeto). `pytest 8.4.2` não apresenta
o problema com a mesma versão do `pytest-django`.

**Alternatives considered**: Atualizar `pytest-django` para uma versão mais nova — não havia, no momento
da implementação, uma versão que declarasse suporte explícito ao `pytest 9.x`; downgrade do `pytest` foi a
correção mais direta e de menor risco.
