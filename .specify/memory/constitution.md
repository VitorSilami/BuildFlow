<!--
Sync Impact Report
Version: [TEMPLATE] → 1.0.0 (initial ratification)
Modified principles: n/a (first fill from template placeholders)
Added sections: Core Principles (6), Stack Tecnológica e Ferramentas, Fluxo de Desenvolvimento, Governance
Removed sections: none
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — generic Constitution Check gate already references
     "Simplicity", "Anti-Abstraction", "Integration-First" (compatible with Principles IV/V, no edits needed)
  ✅ .specify/templates/spec-template.md — no constitution-specific placeholders, compatible as-is
  ✅ .specify/templates/tasks-template.md — generic phase/task structure, compatible as-is
  ✅ .claude/skills/speckit-*/SKILL.md — agent-generic, no project-specific renames needed
Follow-up TODOs: none — all fields derived from the conversation (BuildFlow multitenant RDO/EAP system)
-->

# BuildFlow Constitution

## Core Principles

### I. Isolamento Multitenant Inegociável (NON-NEGOTIABLE)
A empresa (tenant) é a fronteira primária de todo dado de negócio. TODA entidade
(projeto, registro diário, configuração, não conformidade, contrato, etc.) DEVE ter
um caminho verificável até uma empresa, direto ou via FK em cadeia. O backend — nunca
o frontend — é a única fonte de verdade sobre o isolamento: querysets, serializers,
permissions e views DEVEM filtrar por empresa do usuário autenticado em toda listagem,
detalhe, criação, atualização e exclusão. Um cliente NUNCA pode informar livremente o
identificador de outra empresa (`company_id`/`empresa_id` vindos do payload são
ignorados na escrita; a empresa é sempre derivada do usuário autenticado). Toda
funcionalidade nova exige um teste automático demonstrando que um usuário da Empresa A
não acessa, infere ou altera dado da Empresa B.
Rationale: este é um sistema SaaS multitenant desde a concepção (seção 3 do spec
original); uma falha de isolamento é uma falha de segurança crítica, não um bug comum.

### II. Autenticação Federada, Sem Cadastro Público
Não existe cadastro público de usuários. Usuários são criados exclusivamente pelo
Django Admin, vinculados a uma empresa e um perfil antes de poderem autenticar. O
único fluxo de login é Google OAuth 2.0 / OpenID Connect. O backend DEVE validar
emissor, audiência, expiração e e-mail verificado do token do Google antes de
qualquer decisão de sessão. Login é recusado quando: e-mail não cadastrado, usuário
inativo, usuário sem empresa, perfil inválido, ou token inválido/expirado/de outro
client ID. Nenhum secret (client ID/secret, chaves) é exposto no bundle do frontend.
Rationale: reduz superfície de ataque (sem fluxo de signup/senha) e delega a robustez
de autenticação ao provedor de identidade, conforme seção 4 do spec original.

### III. Segurança por Padrão (Backend como Fonte da Verdade)
Toda autorização é revalidada no backend, mesmo quando o frontend já protege rotas.
Sessão/token de autenticação usa cookies `HttpOnly`, `Secure` e `SameSite` sempre que
a arquitetura permitir; tokens sensíveis não vão para `localStorage` sem justificativa
técnica documentada. Serializers nunca usam `fields = "__all__"`; mass assignment de
campos sensíveis (empresa, perfil, flags de permissão) é impossível a partir do
payload do cliente. Mensagens de erro não vazam existência ou dados de outras
empresas. Segredos vivem em variáveis de ambiente, nunca no repositório.
Rationale: cobre OWASP Top 10 / API Security Top 10 (seção 17) sem depender de
disciplina manual recorrente — a proteção é estrutural.

### IV. Arquitetura Limpa e Simplicidade (YAGNI)
Regras de negócio vivem em uma camada de serviços/casos de uso, nunca espalhadas em
views. Campos JSON genéricos só são usados com justificativa explícita (dado
realmente dinâmico ou externo não normalizado) — nunca como atalho para evitar
modelagem adequada. Nenhuma abstração, dependência (Docker, Celery, cloud provider)
ou camada é adicionada antes de haver necessidade real e declarada. Preferir muitos
arquivos pequenos e focados (200-400 linhas, máximo 800) a poucos arquivos grandes;
funções com no máximo ~50 linhas e nesting máximo de 4 níveis.
Rationale: alinhado às regras de coding-style do usuário (imutabilidade, KISS, DRY,
YAGNI) e ao princípio de Simplicidade/Anti-Abstração do template de planejamento.

### V. Testes Automatizados Obrigatórios (NON-NEGOTIABLE)
Cobertura mínima de 80%, com unit, integration e E2E conforme aplicável. Isolamento
multitenant, fluxo de autenticação (aceite e rejeição) e permissões por perfil são
testados antes de uma feature ser considerada concluída — não depois. Falha de teste
nunca é contornada ajustando o teste sem justificativa; a implementação é corrigida
primeiro. TDD (red-green-refactor) é a prática padrão para lógica de negócio nova.
Rationale: os critérios de aceitação do spec original (CA-01 a CA-10) só são
demonstráveis com evidência de teste, não com alegação.

### VI. Rastreabilidade de Decisões e Dados
Toda divergência entre fontes de dados (ex.: protótipo HTML vs. planilha de dados
legados) é documentada explicitamente: campo de origem, arquivo de origem, decisão
adotada e justificativa. Nenhum campo ou regra de negócio é inventado sem ser
identificado como proposta explícita sujeita a aprovação. Decisões arquiteturais
relevantes (ex.: uso do cookiecutter-django, estratégia de sessão) ficam registradas
nos specs/planos do Spec Kit, não apenas na conversa.
Rationale: os dois arquivos de referência do projeto (protótipo HTML e planilha de
dados legados de uma obra real) divergem em escopo e granularidade; sem rastreio
explícito, decisões de modelagem se perdem ou são reinterpretadas incorretamente.

## Stack Tecnológica e Ferramentas

Backend: Django + Django REST Framework + PostgreSQL, com modelo de usuário
customizado e `django-allauth` (modo headless/API para integrar com a SPA) para
Google OAuth/OIDC. Bootstrap inicial do backend via `cookiecutter-django`, mantendo
apenas o essencial (`rest_api=DRF`, sem pipeline de templates/assets Django, sem
Docker/Celery/Sentry/Whitenoise até haver necessidade real) — templates
server-rendered e webpack do gerador são removidos após a geração, pois a UI é 100%
React. Documentação de API via `drf-spectacular` (OpenAPI). Frontend: React +
TypeScript, roteamento protegido, cliente HTTP centralizado, validação por schema.
Fluxo de trabalho e documentação de especificação: **GitHub Spec Kit**
(`.specify/`, skills `speckit-*`) — constitution → specify → clarify → plan → tasks →
implement. Dados legados da planilha de referência (`MODELO IMPORT SOFT`) são usados
como fonte de carga inicial (seed/import), não como definição de schema.

## Fluxo de Desenvolvimento

Trabalho avança em fases (Descoberta → Fundação → Autenticação → Projetos →
Registros/Configurações → Qualidade), cada uma encerrada com: testes executados (ou
explicitamente marcados como não executados, nunca fingidos), arquivos
criados/alterados relacionados, decisões e limitações documentadas. Nenhuma fase
avança deixando erro conhecido sem registro explícito. Revisão de segurança é
obrigatória antes de qualquer commit que toque autenticação, dados sensíveis ou
regras de isolamento multitenant — protocolo: parar, revisar, corrigir crítico antes
de continuar, rotacionar segredo exposto se houver.

## Governance

Esta constituição prevalece sobre preferências de estilo ad hoc quando houver
conflito direto de segurança ou isolamento multitenant. Emendas são feitas via
`/speckit-constitution`, exigem justificativa registrada no Sync Impact Report e
versionamento semântico (MAJOR: remoção/redefinição incompatível de princípio;
MINOR: novo princípio ou expansão material; PATCH: clareza/redação). Todo plano
(`/speckit-plan`) DEVE incluir uma checagem explícita de conformidade com os
Princípios I, II, III e V antes de prosseguir para tarefas. Complexidade adicional
(nova dependência, camada, serviço externo) exige justificativa escrita no plano.

**Version**: 1.0.0 | **Ratified**: 2026-07-16 | **Last Amended**: 2026-07-16
