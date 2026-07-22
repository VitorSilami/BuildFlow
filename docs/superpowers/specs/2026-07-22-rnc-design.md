# RNC (Registro de Não Conformidade) — Design

## Contexto

`RNC` é o terceiro item do backlog explícito de `specs/001-mvp-gestao-diaria/spec.md`
(Assumptions: "EAP completa, RNC (não conformidades), medição de contratos e painéis
de custo/ociosidade — presentes no protótipo HTML mas fora da lista de ações do MVP").
O protótipo funcional de referência (`EPR_Daily_Completo.html`, bloco "NAO
CONFORMIDADES (RNC)", linhas ~2034-2163 e ~3781-4030) já define um modelo rico: registro
formal de não conformidade com identificação, análise de causa raiz (metodologia 6M —
Método, Material, Mão de obra, Máquina, Medição, Meio ambiente), ações corretivas,
workflow de status e rastreabilidade (base para pleito e resposta técnica à contratada).

## Decisões confirmadas

1. **Escopo desta rodada**: só o núcleo — cadastro de RNC, causa raiz 6M, ações
   corretivas e workflow de status. Geração de "ofício técnico" por IA, exportação
   PDF/Excel e integração com mapa **ficam de fora** (o próprio protótipo já marca a
   geração por IA como placeholder de demonstração — "no deploy, o agente orquestrador
   aciona os agentes de disciplina via IA para redigir de forma autônoma").
2. **Taxonomia Categoria → Item**: fixa no código (choices), não um cadastro editável
   por empresa — são categorias técnicas padronizadas do setor (arquivo SERVIÇOS da
   EPR: Terraplenagem, Pavimentação, Contenções, OAEs, OACs e Drenagem, Sinalização e
   Segurança, Outros), não algo que cada empresa deveria poder redefinir.
3. **Reincidência**: campo booleano marcado manualmente por quem registra a RNC — sem
   detecção automática de similaridade com RNCs anteriores.
4. **Permissão**: só o perfil Gerente cria e gerencia RNCs (criar, editar causa raiz,
   concluir). Mesma restrição já usada em Custos & Ociosidade (`IsGerente`).
5. **Workflow de status**: dois estados gravados — `pendente` (default) e `concluida`
   (com campo `eficacia` Eficaz/Ineficaz obrigatório ao concluir). "Prazo excedido" é
   sempre **calculado** (nunca um estado gravado) a partir de `data_prazo` no passado
   enquanto `status == pendente`. Não replica o estado intermediário "Respondida" do
   protótipo (que os próprios dados de exemplo do protótipo não demonstram).
6. **Numeração**: sequencial por projeto (`RNC-001`, `RNC-002`, ...) — sem sigla de
   empresa/polo fixa como no protótipo original (`EPRTR - RNC - 003 - 0626 _ UDI`, que é
   específico da EPR e não generaliza para outras empresas do BuildFlow).
7. **Escopo da tela**: por projeto, mesma consistência arquitetural de Custos &
   Ociosidade e Histórico & Aprovações.

## Arquitetura

Novo app isolado `rnc` (mesmo padrão de `custos_ociosidade`), restrito ao perfil
Gerente. Reaproveita `Projeto.numero_contrato` em vez de duplicar um campo "contrato"
na RNC.

## Schema (`rnc/models.py`)

### `RNC`

Choices fixas: `CategoriaChoices` (Terraplenagem, Pavimentação, Contenções, OAEs, OACs
e Drenagem, Sinalização e Segurança, Outros), `OrigemChoices` (Produto, Serviço,
Pessoal, Segurança, Equipamento, Projeto), `GravidadeChoices` (Alta, Média, Baixa),
`TipoChoices` (AC — Ação Corretiva, AP — Ação Preventiva), `StatusRncChoices`
(pendente, concluida), `EficaciaChoices` (eficaz, ineficaz).

Campos:
- `projeto` (FK `Projeto`)
- `numero_sequencial` (int, gerado por projeto na criação — `RNC.objects.filter(projeto=projeto).count() + 1`)
- `data_emissao` (Date)
- `contratada` (texto livre — nome da empresa contratada, sem cadastro novo)
- `categoria`, `origem`, `gravidade`, `tipo` (choices acima)
- `item`, `subitem` (texto livre — o protótipo não enumera subitem em lugar nenhum;
  `item` é validado no serializer contra a lista de itens da `categoria` escolhida,
  mesmo padrão de validação combinada já usado em `Presenca`/`ApontamentoMaquina`)
- `norma`, `requisito`, `abrangencia`, `km` (texto livre)
- `reincidencia` (bool, manual)
- `descricao` (TextField)
- `acao_imediata` (TextField), `data_implementacao` (Date), `responsavel_implementacao` (texto livre)
- Causa raiz 6M — 12 campos flat (estrutura 1:1 de tamanho fixo, não uma lista, não
  justifica um child model): `causa_metodo` (bool) + `causa_metodo_detalhe` (texto,
  blank), e o mesmo par para `material`, `mao_de_obra`, `maquina`, `medicao`,
  `meio_ambiente`
- `data_prazo` (Date, null/blank)
- `status` (choices, default `pendente`)
- `eficacia` (choices, null/blank — só preenchido ao concluir)
- `data_conclusao` (DateTime, null/blank)
- `criado_por` (FK User), `created_at`, `updated_at`

### `AcaoCorretiva` (FK `rnc`, lista)

- `rnc` (FK `RNC`, related_name `acoes_corretivas`)
- `descricao` (TextField)
- `risco` (TextField)
- `data_limite` (Date)
- `responsavel` (texto livre)

## Regras de negócio (`rnc/services.py`)

- `gerar_numero_sequencial(projeto) -> int`: conta RNCs existentes do projeto + 1.
- `validar_item_da_categoria(*, categoria, item) -> None`: levanta `ValidationError` se
  `item` não estiver na lista de itens válidos daquela `categoria` (`CATEGORIA_ITENS`,
  dict fixo no módulo, espelhando `NC_CATEGORIAS` do protótipo).
- `concluir_rnc(*, rnc, eficacia) -> RNC`: levanta `ValidationError` se `rnc.status !=
  PENDENTE` ("Esta RNC já foi concluída.") ou se `eficacia` vazio. Em sucesso, define
  `status=concluida`, `eficacia`, `data_conclusao=timezone.now()`.
- RNC com `status == concluida` não aceita mais `PATCH` (edição bloqueada no
  serializer/view quando o status já é `concluida` — sem reabertura nesta rodada).
- `status_efetivo` (property/serializer field, read-only): retorna `"prazo_excedido"`
  quando `status == pendente AND data_prazo < hoje`, senão retorna `status` como está.
  Nunca gravado no banco — puro cálculo de leitura, seguindo o princípio de nunca
  fabricar/persistir um dado derivável.

## API

- `GET/POST /api/v1/projetos/{projeto_pk}/rncs/` — lista (com filtro `?status=` e
  `?categoria=`) e criação (RNC + `acoes_corretivas` aninhadas, mesmo padrão de
  criação aninhada do RDO).
- `GET/PATCH /api/v1/rncs/{id}/` — detalhe (rota plana, como o RDO) e edição, bloqueada
  quando `status == concluida`.
- `POST /api/v1/rncs/{id}/concluir/` — body `{"eficacia": "eficaz"|"ineficaz"}`.
- Todas as rotas restritas a `IsAuthenticatedWithEmpresa` + `IsGerente`.
- Serializer expõe `status_efetivo` (read-only, calculado) além dos campos do model.

## Frontend

- Nova página de listagem (`RncListPage`): KPIs (total, em aberto, prazo excedido,
  reincidentes), filtro por status/categoria, cards com identificação resumida —
  mesmo padrão visual de Histórico & Aprovações.
- Nova página de detalhe/formulário (`RncFormPage` ou `RncDetailPage`): identificação,
  causa raiz 6M como checklist (6 pares checkbox + campo de detalhe condicional), lista
  de ações corretivas (adicionar/remover linhas), botão "Concluir" (com seletor de
  eficácia) quando `status == pendente`.
- Item no Sidebar visível só ao perfil Gerente (mesmo padrão de Custos & Ociosidade).

## Testes

- Backend: `gerar_numero_sequencial` incrementa por projeto (não cruza projetos);
  `validar_item_da_categoria` rejeita item fora da categoria; `concluir_rnc` exige
  eficácia e RNC pendente; edição de RNC concluída retorna 400; `status_efetivo`
  calcula "prazo_excedido" corretamente; isolamento multitenant (404, não 403) nas
  rotas nova/existentes; perfil Auxiliar recebe 403 em todas as rotas do app.
- Frontend (e2e): Gerente cria RNC completa (identificação + causa raiz + ações
  corretivas) e vê na listagem; Auxiliar não vê o item no menu e recebe acesso
  restrito na rota; RNC com prazo vencido mostra badge "Prazo excedido" mesmo com
  status gravado `pendente`; concluir uma RNC exige eficácia preenchida; RNC concluída
  não mostra mais os campos de edição.

## Fora de escopo

- Geração de ofício técnico por IA (placeholder mesmo no protótipo).
- Exportação em PDF ("RNC + ofício") e Excel/CSV (controle estatístico).
- Integração com mapa de trecho (RNCs plotados por km).
- Taxonomia Categoria/Item editável por empresa.
- Detecção automática de reincidência.
- Reabertura de RNC concluída / estado intermediário "Respondida".
- Fila cross-projeto (RNCs de todos os projetos numa tela só).
