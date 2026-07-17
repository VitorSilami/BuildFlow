# Quickstart / Validation Guide: MVP Gestão Diária de Obras

Guia para rodar o ambiente local e validar as 5 histórias de usuário do spec ponta a ponta. Não contém
código de implementação — apenas comandos e roteiro de verificação.

## Pré-requisitos

- Python 3.14, Node.js LTS, PostgreSQL 16+ rodando localmente, [uv](https://docs.astral.sh/uv/) instalado
- Um role/database Postgres para o projeto, ex.: `CREATE ROLE buildflow WITH LOGIN PASSWORD '...' CREATEDB; CREATE DATABASE buildflow OWNER buildflow;`
- Client ID/Secret de um projeto Google OAuth (tela de consentimento configurada para `http://localhost`)
- `backend/.env` preenchido a partir de `.env.example` (DB, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `SECRET_KEY`) — lido automaticamente se o arquivo existir (ver Correção de DX abaixo)
- `frontend/.env` preenchido a partir de `frontend/.env.example`

## Setup

```bash
# Backend
cd backend
uv sync                                    # cria .venv e instala dependencias (pyproject.toml/uv.lock)
export DJANGO_SETTINGS_MODULE=config.settings.local
uv run python manage.py migrate
uv run python manage.py createsuperuser
uv run python manage.py seed_demo_data     # cria 2 empresas, gerente+auxiliar por empresa, 2 projetos por empresa, RDOs e configs de exemplo
uv run python manage.py seed_legacy_data   # popula EAP/metas de um projeto a partir de MODELO IMPORT SOFT
uv run python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

## Roteiro de validação por história

**História 1 — Provisionamento**: acessar `/admin/`, confirmar que as 2 empresas seed existem, criar uma
terceira empresa e um usuário Gerente vinculado a ela; confirmar que a criação falha se a empresa não for
selecionada.

**História 2 — Login/Logout**: abrir o frontend, clicar "Entrar com Google" com uma conta correspondente a um
usuário seed ativo → deve cair na listagem de projetos da empresa correta. Tentar com um e-mail não
cadastrado → deve ser recusado com mensagem genérica. Marcar um usuário como inativo no Admin e tentar login
com ele → deve ser recusado. Fazer logout → deve voltar para a tela de login; acessar uma URL interna
diretamente após logout → deve redirecionar para login.

**História 3 — Projetos**: com um usuário da Empresa A autenticado, criar um projeto novo; confirmar que ele
aparece na listagem. Abrir uma segunda sessão de navegador (contexto anônimo) autenticada como usuário da
Empresa B → o projeto criado na Empresa A não deve aparecer nem ser acessível por URL direta (copiar o ID do
projeto da Empresa A e tentar acessar `/projetos/{id}` logado como Empresa B → esperado 404 tratado como
"não encontrado").

**História 4 — RDO**: dentro de um projeto, criar um registro diário preenchendo todas as etapas (gerais,
produção, equipe, máquinas, ocorrências, foto). Confirmar que o registro aparece na listagem do projeto e que
os cálculos derivados (eficiência de máquina) aparecem corretos na visualização. Repetir o teste de
isolamento cross-tenant da História 3 para o endpoint de RDO.

**História 5 — Configurações**: dentro de um projeto, cadastrar uma meta, uma equipe com pessoas e máquinas,
e um valor de custo; confirmar que RDOs subsequentes conseguem referenciar essa equipe/pessoas/máquinas na
etapa de presença/máquinas. Repetir o teste de isolamento cross-tenant.

## Comandos de teste

```bash
# Backend — inclui a suíte dedicada de isolamento multitenant (buildflow/*/tests/test_isolation.py)
# DJANGO_SETTINGS_MODULE=config.settings.test usa MD5PasswordHasher (mais rapido) e cria um DB de teste
# a parte (a role do Postgres usada precisa de privilegio CREATEDB)
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest --cov

# Frontend — unit/integration
cd frontend && npm run test

# E2E (Playwright) — cobre os 8 fluxos da seção 18 do brief original
cd frontend && npm run test:e2e
```

## Critério de "passou"

Todos os comandos acima retornam código de saída 0, cobertura de backend ≥ 80%, e nenhum dos passos do
roteiro manual acima permite acesso cruzado entre a Empresa A e a Empresa B.
