# Data Model: MVP Gestão Diária de Obras

Origem de cada entidade rastreada conforme relatório de Fase 1 (Descoberta): **H** = protótipo
`EPR_Daily_Completo.html`, **X** = planilha `MODELO IMPORT SOFT` (dado legado, usado como seed — não como
definição de schema), **N** = nova (multitenancy/auth, não existente em nenhum dos dois arquivos de
referência, Princípio VI).

## Empresa (N)

Fronteira de isolamento multitenant. Toda entidade abaixo tem caminho até `Empresa`, direto ou via FK em
cadeia (Princípio I).

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| nome | string(255) | sim | |
| slug | string, único | sim | identificador interno |
| is_active | boolean | sim, default true | usuário de empresa inativa não autentica |
| created_at / updated_at | datetime | auto | |

## Usuario (N) — custom user model

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| nome | string(255) | sim | |
| email | string, único | sim | usado como identidade no login Google |
| empresa | FK → Empresa | sim | **nunca alterável pelo próprio usuário via API** |
| perfil | enum: `gerente`, `auxiliar_administrativo` | sim | |
| is_active | boolean | sim, default true | |
| is_staff | boolean | sim, default false | acesso ao Django Admin |
| created_at / updated_at | datetime | auto | |

**Regra de validação**: criação de `Usuario` sem `empresa` MUST falhar (constraint `null=False`, sem default).
Autenticação MUST ser recusada quando `is_active=False`, `empresa=None`, ou `perfil` fora do enum.

## Projeto (H — seção "Nova Produção"/config geral; nome dos campos ajustado ao vocabulário do brief)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| empresa | FK → Empresa | sim | atribuída automaticamente a partir de `request.user.empresa`, nunca do payload |
| nome | string(255) | sim | não vazio/não só espaços (FR-016); não único por empresa (Assumption) |
| descricao | text | não | "breve descrição" |
| criado_por | FK → Usuario | sim | atribuído automaticamente |
| created_at / updated_at | datetime | auto | |

## RegistroDiario / RDO (H — wizard "Nova Produção", etapas Gerais/Resumo)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| projeto | FK → Projeto | sim | empresa derivada via `projeto.empresa` |
| data_referencia | date | sim | não único por projeto+data (Assumption: múltiplos RDOs/dia permitidos) |
| turno | enum: `diurno`, `noturno` | sim | H: "Diurno · 07:00–17:00", "Noturno" |
| clima | enum: `sol`, `nublado`, `chuva`, `chuva_forte` | sim | H: botões de clima |
| equipe | FK → Equipe (config) | sim | |
| fiscal | FK → Usuario | sim | H: `g-fiscal`; vinculado ao cadastro de usuários (mesmo modelo de Autor), sem papel de aprovação nesta versão (Clarification) |
| autor | FK → Usuario | sim | automático |
| atualizado_por | FK → Usuario, nullable | não | automático em updates |
| created_at / updated_at | datetime | auto | |

*Nota*: sem estado de aprovação (`status`) nesta versão — decisão registrada na spec (Clarifications,
2026-07-16).

### ProducaoDiaria (H — etapa "Produção")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| registro_diario | FK → RegistroDiario | sim | |
| rodovia | string ou FK → Rodovia (config) | sim | |
| sentido | enum (default temporário: `crescente`, `decrescente` — ver Nota) | sim | H: `SENTIDOS` |
| disciplina | FK → Disciplina (config) | sim | |
| servico | FK → CatalogoServico (config) | sim | |
| km_inicial / km_final | decimal | sim | formato "606+400" convertido para decimal em km |
| quantidade | decimal | sim | |
| unidade | FK → Unidade (enum/tabela) | sim | X: vb, m², m³, m, t, un, "m² eq." |

*Nota*: valores reais de `SENTIDOS` não confirmados nos arquivos de referência (dúvida já registrada na
Fase 1/Descoberta, item 4). `crescente`/`decrescente` é um default assumido para viabilizar a implementação;
deve ser confirmado/ajustado antes ou durante T046.

### Presenca (H — etapa "Equipe")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| registro_diario | FK → RegistroDiario | sim | |
| pessoa | FK → Pessoa (config), nullable | não | preenchido quando vinculado a cadastro |
| nome_avulso | string, nullable | não | preenchido quando lançamento avulso (Clarification) |
| funcao | string | sim | |
| status | enum: `presente`, `falta`, `atestado` | sim | |
| origem | enum: `composicao`, `avulso` | sim (derivado) | `composicao` se `pessoa` setado, senão `avulso` |

**Regra**: exatamente um de `pessoa` ou `nome_avulso` MUST estar preenchido (constraint de aplicação).

### ApontamentoMaquina (H — etapa "Máquinas")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| registro_diario | FK → RegistroDiario | sim | |
| maquina | FK → Maquina (config), nullable | não | |
| identificacao_avulsa | string, nullable | não | nome/código digitado na hora (Clarification) |
| horas_produtivas | decimal | sim | |
| horas_paradas | decimal | sim, default 0 | |
| motivo_parada | FK → MotivoParada, nullable | condicional | obrigatório apenas quando `horas_paradas > 0` |
| origem | enum: `composicao`, `avulso` | sim (derivado) | |

**Campo calculado (não persistido)**: eficiência = `horas_produtivas / (horas_produtivas + horas_paradas)`.

### Ocorrencia (H — etapa "Ocorrências")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| registro_diario | FK → RegistroDiario | sim | |
| tipo | enum: `climatica`, `interferencia`, `seguranca`, `logistica`, `qualidade`, `outro` | sim | |
| recurso_afetado | enum: `maquinarios`, `mao_de_obra`, `materiais`, `recursos`, `area_frente`, `outro` | sim | |
| descricao | text | sim | |

### Foto (H — etapa "Fotos"; incluída no MVP por decisão de Clarification)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| registro_diario | FK → RegistroDiario | sim | |
| arquivo | FileField/ImageField | sim | validação de tipo/tamanho na camada de serviço (Princípio III) |
| km | decimal, nullable | não | geo-referência por km, quando disponível |
| created_at | datetime | auto | |

## ConfiguracaoProjeto — agrupamento (H — aba "Configurações"; X aporta valores de EAP/quantidade como seed)

Modelada como um conjunto de entidades filhas de `Projeto`, não uma única tabela genérica (Princípio IV —
sem JSON genérico sem justificativa).

### Meta (H — sub-aba "Metas")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| projeto | FK → Projeto | sim | |
| disciplina | FK → Disciplina | sim | X: `BASE_EAP`.DISCIPLINA como catálogo aberto, não enum fechado |
| unidade | FK → Unidade | sim | |
| valor_alvo | decimal | sim | H: "Meta Uberlândia/Patrocínio" generalizado para um único valor-alvo (polo tratado como atributo textual do projeto, não dimensão própria — Assumption da spec) |
| peso_percentual | decimal | não | H: peso por disciplina; validação de soma ≈100% fica em `services.py`, não em constraint de banco |

### Equipe (H — sub-aba "Frentes & Equipes")

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| projeto | FK → Projeto | sim | |
| nome | string | sim | |
| encarregado | FK → Pessoa, nullable | não | |

### Pessoa (H — cadastro de integrante de equipe)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| equipe | FK → Equipe | sim | |
| nome | string | sim | |
| funcao | FK → FuncaoCusto ou string | sim | |

### Maquina (H — pool de máquinas por equipe)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| equipe | FK → Equipe, nullable | não | pool pode ser do projeto sem equipe específica |
| codigo | string | sim | |
| nome | string | sim | |

### ValorCusto (H — sub-aba "Valores dos Contratos"; recorte de custo de mão de obra/equipamento, sem o módulo de contratos/medição completo — fora de escopo do MVP)

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | UUID (PK) | sim | |
| projeto | FK → Projeto | sim | |
| tipo | enum: `mao_de_obra`, `equipamento` | sim | |
| descricao | string | sim | nome da função ou do equipamento |
| valor | decimal | sim | valor mensal (mão de obra) ou custo/hora (equipamento) |

## Tabelas de apoio (enums abertos como cadastro, não `choices` fixo, quando o XLSX indicou catálogo aberto)

Criadas na fase Foundational (tasks.md T020), não em US5 — são pré-requisito tanto de `ProducaoDiaria` (US4)
quanto de `Meta` (US5), e nenhuma das duas tem fallback avulso para elas.

- **Disciplina** (X, catálogo aberto): nome, projeto
- **Unidade** (X, autoritativo): sigla (vb, m², m³, m, t, un, "m² eq."), descrição
- **CatalogoServico** (H): disciplina, nome, unidade
- **MotivoParada** (H): descrição

## Seed de dados legados (X)

O import inicial (comando de management `seed_legacy_data`) usa `BASE_EAP` e `BASE_QTD_L2` da planilha
`MODELO IMPORT SOFT` para popular `Disciplina`, `Meta`/estrutura de EAP de um projeto de demonstração — não
define schema, apenas dados de exemplo, conforme decisão do usuário registrada em memória de projeto.

## Regras de validação centrais (Princípio I / III)

- Toda query MUST passar por `TenantScopedQuerySet` filtrando por `request.user.empresa`.
- `empresa` (em `Projeto`) e `projeto` (nas demais entidades, implicando empresa) MUST ser atribuídos no
  `perform_create()` do backend a partir do contexto autenticado — nunca aceitos como campo gravável nos
  serializers.
- Serializers MUST declarar `fields` explicitamente; nunca `fields = "__all__"`.
