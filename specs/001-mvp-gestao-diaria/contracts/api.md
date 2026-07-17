# API Contract: MVP Gestão Diária de Obras

Base path: `/api/v1/`. Documentação OpenAPI gerada automaticamente via `drf-spectacular` a partir dos
serializers/views (não duplicada aqui manualmente). Este documento fixa o contrato de alto nível que
`tasks.md` e a implementação devem respeitar — é o resultado do design, não a especificação executável.

Convenção geral (Princípio I/III): nenhum endpoint de escrita aceita `empresa`/`empresa_id`/`projeto.empresa`
no corpo da requisição. A empresa é sempre derivada de `request.user.empresa`, e o pertencimento de um
`projeto` a essa empresa é sempre revalidado no `get_queryset()`, nunca assumido a partir do ID informado.

## Autenticação

**Correção pós-design**: implementado com os endpoints nativos do `django-allauth` headless (client
`browser`) em vez de endpoints custom em `/api/v1/auth/*` — reaproveita a validação de ID token
(emissor/audiência/expiração, FR-007) já implementada e testada pela própria lib, em vez de reimplementar
verificação de JWT do zero. Ver research.md, item 1 (refinamento).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/_allauth/browser/v1/auth/provider/token` | Corpo: `{"provider": "google", "process": "login", "token": {"id_token": "..."}}`. Valida o ID token (assinatura/emissor/audiência/expiração) via `allauth`; `SocialAccountAdapter.pre_social_login` aplica as regras de negócio (usuário deve existir, ativo, com empresa e perfil válidos — FR-008); cria sessão (cookie `HttpOnly`) se aprovado, 401 JSON `{"detail": "..."}` caso contrário |
| GET | `/_allauth/browser/v1/auth/session` | Retorna usuário autenticado (id, email, nome, perfil, empresa, empresa_nome — via `HeadlessAdapter.serialize_user`) ou 401 |
| DELETE | `/_allauth/browser/v1/auth/session` | Encerra a sessão atual (logout) |

## Projetos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/projetos/` | Lista projetos da empresa do usuário autenticado (paginado) |
| POST | `/api/v1/projetos/` | Cria projeto (`nome`, `descricao`); `empresa`/`criado_por` atribuídos no backend |
| GET | `/api/v1/projetos/{id}/` | Detalhe de um projeto — 404 se não pertencer à empresa do usuário |

## Registros Diários (RDO)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/projetos/{projeto_id}/registros-diarios/` | Lista RDOs do projeto (só se projeto pertence à empresa do usuário) |
| POST | `/api/v1/projetos/{projeto_id}/registros-diarios/` | Cria RDO com sub-recursos aninhados no payload JSON: `producoes[]`, `presencas[]`, `maquinas[]`, `ocorrencias[]` |
| GET | `/api/v1/registros-diarios/{id}/` | Detalhe completo de um RDO (incl. sub-recursos e fotos) |
| POST | `/api/v1/registros-diarios/{id}/fotos/` | **Correção pós-design**: fotos NÃO vão no payload de criação do RDO (multipart + JSON aninhado é inviável) — upload multipart separado (`arquivo`, `km` opcional), após o RDO já existir |
| GET | `/api/v1/projetos/{projeto_id}/configuracao-rdo/` | **Endpoint adicionado durante US4**: bootstrap somente-leitura (disciplinas com serviços, unidades, equipes com pessoas/máquinas, motivos de parada) para popular os seletores do formulário de RDO — antecipação necessária porque a UI de RDO precisa desses dados antes de US5 (CRUD de configuração) existir |

## Configurações do Projeto

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/projetos/{projeto_id}/configuracao/` | Retorna metas, equipes (com pessoas/máquinas) e valores de custo do projeto |
| POST | `/api/v1/projetos/{projeto_id}/configuracao/metas/` | Cria meta (disciplina, unidade, valor-alvo, peso) |
| POST | `/api/v1/projetos/{projeto_id}/configuracao/equipes/` | Cria equipe (nome, encarregado) |
| POST | `/api/v1/projetos/{projeto_id}/configuracao/equipes/{equipe_id}/pessoas/` | Adiciona pessoa à equipe |
| POST | `/api/v1/projetos/{projeto_id}/configuracao/equipes/{equipe_id}/maquinas/` | Adiciona máquina ao pool da equipe |
| POST | `/api/v1/projetos/{projeto_id}/configuracao/valores/` | Cria valor de custo (mão de obra ou equipamento) |
| PATCH | `/api/v1/configuracoes/.../{id}/` | Edição in-place de qualquer item de configuração acima |

## Respostas de erro padronizadas

| Situação | Status | Corpo |
|---|---|---|
| Não autenticado (endpoints `/api/v1/*`) | 403 | `{"detail": "As credenciais de autenticação não foram fornecidas."}` — comportamento padrão do DRF com `SessionAuthentication` (sem desafio `WWW-Authenticate`, por isso 403 em vez de 401; confirmado na implementação) |
| Não autenticado (endpoints `/_allauth/*`) | 401 | Resposta do allauth headless (`meta.is_authenticated: false`) |
| Recurso de outra empresa (qualquer entidade) | 404 | `{"detail": "Não encontrado."}` — nunca 403, para não confirmar existência |
| Validação de campo | 400 | `{"campo": ["mensagem"]}` por campo, consumido pelo frontend para exibir erro próximo ao campo (FR-028) |
| Login recusado (inativo/sem empresa/e-mail não cadastrado/token inválido) | 401 | `{"detail": "Acesso não autorizado."}` — mensagem genérica, sem detalhar o motivo exato (evita enumeração de contas) |

## Fora de escopo desta versão (contratos que não existem ainda)

Endpoints de não conformidade (RNC), medição de contratos e painéis de custo/ociosidade — presentes no
protótipo HTML mas fora do escopo desta spec (ver Assumptions em spec.md).
