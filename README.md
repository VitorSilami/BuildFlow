# BuildFlow

Sistema multitenant de gestão diária de obras: empresas, projetos, registros diários (RDO) e
configurações de projeto. Backend Django + DRF, frontend React + TypeScript, login exclusivo via Google.

Documentação completa da feature MVP em [`specs/001-mvp-gestao-diaria/`](specs/001-mvp-gestao-diaria/)
(spec, plano técnico, modelo de dados, contratos de API, decisões de arquitetura).

## Stack

- **Backend**: Django 6, Django REST Framework, PostgreSQL, `django-allauth` (headless, login Google),
  `drf-spectacular` (OpenAPI). Gerenciado com [`uv`](https://docs.astral.sh/uv/).
- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Zod, React Router. UI com Tailwind CSS v4 +
  shadcn/ui (tokens OKLCH, tema claro/escuro), layouts e componentes isolados em
  `frontend/src/layouts/` e `frontend/src/components/ui/`.

## Pré-requisitos

- Python 3.14, Node.js LTS, PostgreSQL 16+, [`uv`](https://docs.astral.sh/uv/) instalado
- Um Client ID/Secret de OAuth do Google (para testar o login real — sem isso, só os testes
  automatizados, que mockam a autenticação, funcionam)

## Setup local

### 1. Banco de dados

```bash
psql -U postgres -c "CREATE ROLE buildflow WITH LOGIN PASSWORD 'sua_senha' CREATEDB;"
psql -U postgres -c "CREATE DATABASE buildflow OWNER buildflow;"
```

### 2. Backend

```bash
cd backend
uv sync
cp ../.env.example .env   # preencha DATABASE_URL, GOOGLE_CLIENT_ID/SECRET, SECRET_KEY

export DJANGO_SETTINGS_MODULE=config.settings.local

uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py seed_demo_data     # 2 empresas, usuários, projetos, RDO e config de exemplo
uv run python manage.py seed_legacy_data   # importa a EAP da planilha MODELO IMPORT SOFT
uv run python manage.py runserver
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # preencha VITE_GOOGLE_CLIENT_ID
npm run dev
```

Acesse `http://localhost:5173`. O Django Admin fica em `http://localhost:8000/admin/`, a documentação da
API em `http://localhost:8000/api/docs/`.

## Testes

```bash
# Backend (61+ testes: contrato, isolamento multitenant, validações de negócio)
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov

# Frontend — unit/integration
cd frontend
npm run test

# Frontend — E2E (Playwright, mocka backend e Google Identity Services)
npm run test:e2e
```

## Segurança

- Nunca commitar `.env` (já coberto pelo `.gitignore` em `backend/`, `frontend/` e na raiz)
- Login exclusivo via Google — sem cadastro público, usuários criados só pelo Django Admin
- Isolamento multitenant garantido no backend (nunca confiar em `empresa`/`projeto` vindo do payload do
  cliente) — ver Princípio I da [constituição](.specify/memory/constitution.md)

## Limitações conhecidas (backlog)

- Não conformidades (RNC), medição de contratos e painéis de custo/ociosidade do protótipo original
  ficaram fora do escopo do MVP (ver Assumptions em `specs/001-mvp-gestao-diaria/spec.md`)
- Sem workflow de aprovação de RDO nesta versão
- Enum `Sentido` (crescente/decrescente) é um default assumido — valores reais do domínio não confirmados
  nos arquivos de referência originais
