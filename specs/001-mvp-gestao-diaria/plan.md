# Implementation Plan: MVP Gestão Diária de Obras (Multitenant)

**Branch**: `001-mvp-gestao-diaria` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-mvp-gestao-diaria/spec.md`

## Summary

Construir o núcleo de um SaaS multitenant de gestão diária de obras: Django Admin para provisionar
empresas/usuários, login exclusivo via Google (django-allauth, modo headless, sessão em cookie `HttpOnly`),
CRUD de projetos, registros diários (RDO) com produção/presença/máquinas/ocorrências/fotos, e configurações
de projeto (metas/equipes/valores), tudo isolado por empresa a nível de aplicação (shared DB, shared schema,
filtragem obrigatória por tenant em toda camada). Backend Django+DRF bootstrapado com `cookiecutter-django`
(escopo reduzido); frontend React+TypeScript consumindo a API via cliente HTTP centralizado.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x + React 18 (frontend)

**Primary Dependencies**: Django 5.x, Django REST Framework, django-allauth (headless + Google provider),
drf-spectacular (OpenAPI), django-environ; React, React Router, uma lib de data-fetching (TanStack Query),
Zod (validação de schema no frontend)

**Storage**: PostgreSQL 16; arquivos de foto do RDO em armazenamento local (`MEDIA_ROOT`) em desenvolvimento,
com `Storage` backend do Django pluggável para objeto compatível com S3 em produção (não implementado nesta
fase — YAGNI, ver research.md)

**Testing**: pytest + pytest-django + factory_boy + DRF `APITestCase` (backend, incl. testes dedicados de
isolamento multitenant); Vitest + React Testing Library (frontend unit/integration); Playwright (E2E)

**Target Platform**: Aplicação web (servidor Linux para o backend; navegador desktop/mobile para o frontend)

**Project Type**: Web application (backend Django/DRF + frontend React/TS separados)

**Performance Goals**: Latência de API percebida como instantânea para operações de CRUD comuns (padrão de
aplicação web de gestão interna, sem requisito de tempo real); sem meta de req/s especificada — escala
inicial não justifica otimização prematura (ver Scale/Scope)

**Constraints**: Cookies de sessão `HttpOnly`+`Secure`+`SameSite`; nenhum secret no bundle do frontend;
nenhum dado de uma empresa acessível por usuário de outra empresa sob nenhuma circunstância (Princípio I da
constituição)

**Scale/Scope**: Dezenas de empresas-cliente, dezenas de usuários por empresa, poucos projetos ativos por
empresa, RDOs criados diariamente por projeto (baixo volume absoluto) — escala típica de SaaS B2B para
construção civil, não big-data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|---|---|---|
| I. Isolamento Multitenant Inegociável | Todo modelo de negócio tem caminho até `Empresa`; querysets usam manager/mixin que filtra por `request.user.empresa`; `empresa` nunca é campo gravável a partir do payload do cliente; suite de testes dedicada a acesso cruzado entre empresas | PASS (garantido pelo design em data-model.md e contracts/) |
| II. Autenticação Federada, Sem Cadastro Público | `django-allauth` com apenas o provider Google habilitado; nenhuma view de signup/local exposta na API; validação de emissor/audiência/expiração/e-mail verificado delegada à lib, configuração explícita | PASS |
| III. Segurança por Padrão | Sessão via cookie `HttpOnly`/`Secure`/`SameSite=Lax`; serializers DRF com `fields` explícitos (nunca `__all__`); `empresa`/`criado_por` sempre atribuídos no `perform_create`, nunca aceitos do request body | PASS |
| IV. Arquitetura Limpa e Simplicidade (YAGNI) | Regras de negócio em camada de `services/`; sem Docker/Celery/cloud provider nesta fase (removidos do scaffold do cookiecutter-django); sem versionamento de configuração (decidido no spec) | PASS |
| V. Testes Automatizados Obrigatórios | pytest-django com testes de isolamento multitenant, autenticação (aceite/rejeição) e permissões antes de cada feature ser considerada pronta | PASS (estrutura de testes definida em Project Structure) |
| VI. Rastreabilidade de Decisões e Dados | data-model.md referencia explicitamente a origem de cada campo (relatório de Fase 1: HTML vs. XLSX) | PASS |

Nenhuma violação identificada — Complexity Tracking permanece vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-gestao-diaria/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── api.md
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Option 2: Web application (backend Django/DRF + frontend React/TS)
backend/
├── config/
│   └── settings/           # base.py, local.py, production.py (django-environ)
├── buildflow/                # pacote do projeto (convencao nativa do cookiecutter-django;
│                              # apps referenciados como buildflow.<app> em INSTALLED_APPS —
│                              # decisao tomada na implementacao para nao lutar contra o
│                              # gerador, ver research.md)
│   ├── empresas/            # Empresa (tenant)
│   │   ├── models.py
│   │   ├── admin.py
│   │   └── tests/
│   ├── usuarios/             # Custom User model, perfis, integração allauth
│   │   ├── models.py
│   │   ├── adapters.py       # SocialAccountAdapter (regra de vínculo empresa/ativo)
│   │   ├── admin.py
│   │   └── tests/
│   ├── core/                  # TenantScopedQuerySet/Manager, permissions, mixins base
│   │   ├── permissions.py
│   │   ├── querysets.py
│   │   └── tests/
│   ├── projetos/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── services.py
│   │   └── tests/
│   ├── registros_diarios/
│   │   ├── models.py          # RegistroDiario, ProducaoDiaria, Presenca, ApontamentoMaquina, Ocorrencia, Foto
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── services.py
│   │   └── tests/
│   └── configuracoes/
│       ├── models.py          # ConfiguracaoProjeto, Meta, Equipe, Pessoa, Maquina, ValorCusto
│       ├── serializers.py
│       ├── views.py
│       ├── services.py
│       └── tests/
├── requirements/
└── manage.py

frontend/
├── src/
│   ├── app/                   # bootstrap, providers, rotas
│   ├── pages/                  # LoginPage, ProjetosListPage, ProjetoDetailPage (sidebar), RdoPage, ConfigPage
│   ├── components/              # componentes reutilizáveis (formulários, tabelas, estados vazio/erro)
│   ├── features/                 # auth/, projetos/, registros-diarios/, configuracoes/
│   ├── hooks/
│   ├── services/                  # cliente HTTP centralizado (api client)
│   ├── schemas/                    # validação (Zod) espelhando os contratos da API
│   ├── types/                       # tipos gerados/derivados do contrato OpenAPI
│   └── routes/
└── tests/
```

**Structure Decision**: Web application com backend e frontend em diretórios de nível superior separados
(`backend/`, `frontend/`), conforme Opção 2 do template — a UI é 100% React/SPA consumindo a API DRF, sem
templates Django server-rendered. Backend organizado por app Django de domínio (não por tipo de arquivo),
cada app com sua própria camada de `services.py` para regras de negócio, conforme Princípio IV. Apps vivem
em `backend/buildflow/<app>/` (convenção nativa do `cookiecutter-django`, não em `backend/apps/` como
desenhado inicialmente) — decisão tomada durante a implementação para não lutar contra o gerador
(Princípio IV/YAGNI); ver research.md.

**Correção pós-design**: `Projeto` (originalmente modelado em US3) foi adiantado para a fase Foundational
porque `Disciplina`/`CatalogoServico` (tabelas de apoio compartilhadas, T020) têm FK obrigatória para
`Projeto` — dependência descoberta durante a implementação, não prevista no `/speckit-analyze`. Ver nota em
tasks.md.

## Complexity Tracking

*Sem violações da Constitution Check — tabela não aplicável nesta fase.*
