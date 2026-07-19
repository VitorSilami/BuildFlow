# Field OS — Edição de Projetos e Redesign de Cards

## Contexto

O usuário anexou um mockup (card de projeto com badge de status, ícones de trecho/engenheiro/
último RDO, barra de progresso e botão "Entrar") e uma lista de requisitos funcionais/UI pedindo
para elevar a tela de Projetos além do que foi entregue nos planos anteriores
(`2026-07-18-field-os-backend.md`, `2026-07-19-field-os-frontend-dashboard.md`,
`2026-07-19-field-os-frontend-projetos.md`). A peça central e genuinamente nova aqui é edição de
projeto — hoje `ProjetoViewSet` só suporta list/create/retrieve, e os planos anteriores
documentaram isso explicitamente como uma limitação conhecida ("não há ainda edição de projeto").
Este documento formaliza a decisão de adicionar essa capacidade, mais o redesign visual da lista.

## Decisões

1. **`Projeto` ganha um endpoint de edição real**: `ProjetoViewSet` passa a incluir
   `mixins.UpdateModelMixin` (`PATCH`/`PUT /api/v1/projetos/{id}/`). Os campos editáveis são
   exatamente os mesmos já aceitos na criação (`nome`, `descricao`, `numero_contrato`, `trecho`,
   `engenheiro_responsavel`, `status`) — `empresa`, `criado_por` e `execucao_percentual` continuam
   `read_only_fields`, então já são protegidos contra escrita sem nenhum código adicional. O
   isolamento multitenant (Princípio I) é automático: `TenantScopedViewSetMixin.get_queryset()` já
   escopa por empresa, então editar o projeto de outra empresa resulta em 404, exatamente como já
   acontece hoje no `retrieve`.
2. **`trecho` continua sendo um único campo de texto livre** (ex.: "BR-116 · km 120-185") — o
   mockup mostra rodovia/km como se fossem dois dados, mas isso é só apresentação visual (ícone de
   estrada + o texto do campo já existente). Decisão confirmada com o usuário: não criar
   `rodovia`/`km_inicial`/`km_final` como campos separados — isso exigiria uma nova migration e
   quebraria o campo já em produção sem ganho real, já que o texto livre já cobre o caso de uso.
3. **Novo campo `ultimo_rdo_data`** no `ProjetoSerializer` (read-only, `date | null` serializado
   como string ISO ou `null`): data do `RegistroDiario` mais recente do projeto. A lógica de buscar
   "o RDO mais recente de um projeto" já existe, inline, dentro de `DashboardView` (usada para
   calcular `dias_sem_rdo` nos alertas) — será extraída para uma função compartilhada
   `obter_ultima_data_rdo(projeto) -> date | None` em `projetos/services.py`, usada tanto pelo
   serializer quanto pelo `DashboardView` (que passa a chamar essa função em vez de repetir a
   query).
4. **Criar e editar projeto usam o mesmo formulário.** `ProjetoForm` ganha uma prop opcional
   `projeto?: Projeto`: quando presente, o formulário inicializa os campos com os valores do
   projeto e envia por `PATCH` (novo hook `useAtualizarProjeto(projetoId)`) em vez de `POST`; o
   texto do botão e o callback de sucesso (renomeado de `onCreated` para `onSuccess`, já que não é
   mais só "criado") se ajustam ao modo. Isso evita duplicar toda a lógica de validação/campos em
   dois componentes.
5. **Criação e edição abrem em modal (`Dialog`)**, substituindo o `<Card>` que hoje expande inline
   na página. O botão "Novo Projeto" abre o modal em modo criação; um novo ícone de lápis em cada
   card abre o mesmo modal em modo edição, pré-preenchido. `Dialog` já está vendorizado
   (`components/ui/dialog.tsx`) mas nunca foi consumido — este é o primeiro uso.
6. **Cards redesenhados**: ícones (📍 trecho, 👤 engenheiro, 📅 último RDO) nas linhas de detalhe;
   badge de status com cores semânticas reais (verde/ativo, âmbar/pausado, cinza/concluído — as
   variantes atuais do `Badge` são genéricas, então isso exige classes Tailwind customizadas, não
   um novo componente); execução vira uma barra `Progress` (vendorizada, também primeiro uso) em
   vez de só texto — mostrada apenas quando `execucao_percentual` não é `null` (nunca uma barra em
   0% sugerindo "zero executado" quando na verdade é "sem dado", mesma regra de nunca inventar
   número já aplicada em todo o resto do Field OS).
7. **Busca em texto na própria página**, além dos tabs de status já existentes: filtra a lista já
   carregada por `nome`, `trecho` ou `engenheiro_responsavel` (client-side, mesmo padrão já usado
   em todo o app — sem endpoint novo). Isso é uma busca *local* à página de Projetos, diferente e
   independente da busca já existente no Topbar (que é uma busca rápida global, navega para fora
   da página).
8. **Ação principal do card vira "Entrar"** (botão primário, leva para Registros diários — a ação
   mais frequente no dia a dia) **+ um ícone de engrenagem separado** (leva para Configurações),
   substituindo os dois links de texto atuais.
9. **Sidebar e Topbar ficam `sticky`** ao rolar a página (hoje rolam junto com o conteúdo).

## Arquitetura

### Backend

- `backend/buildflow/projetos/views.py`: `ProjetoViewSet` ganha `mixins.UpdateModelMixin` na lista
  de bases.
- `backend/buildflow/projetos/services.py`: nova função `obter_ultima_data_rdo(projeto) -> date | None`;
  `DashboardView.get()` passa a usar essa função em vez da query inline que já tinha.
- `backend/buildflow/projetos/serializers.py`: `ProjetoSerializer` ganha
  `ultimo_rdo_data = serializers.SerializerMethodField()`.
- Testes: `backend/buildflow/projetos/tests/test_api.py` (PATCH aceita os campos editáveis;
  `ultimo_rdo_data` aparece corretamente com/sem RDO), novo teste de isolamento (empresa B não
  edita projeto de empresa A → 404, mesma convenção do `retrieve`).

### Frontend

- `frontend/src/features/projetos/projetosApi.ts`: novo hook `useAtualizarProjeto(projetoId)`
  (PATCH, invalida a query `['projetos']` no sucesso, mesmo padrão de `useCriarProjeto`).
- `frontend/src/features/projetos/ProjetoForm.tsx`: ganha a prop opcional `projeto?: Projeto`;
  `onCreated` renomeado para `onSuccess`.
- `frontend/src/types/projeto.ts`: `Projeto` ganha `ultimo_rdo_data: string | null`.
- `frontend/src/lib/format.ts`: novo helper `formatData(iso: string | null): string` (formata data
  ISO em `dd/mm/aaaa`, ou "Nunca registrado" quando `null`) — usado pelo card.
- `frontend/src/pages/ProjetosListPage.tsx`: reescrita — modal de criação/edição via `Dialog` +
  `ProjetoForm`, busca em texto, cards redesenhados (ícones, badge colorido, `Progress`, botão
  "Entrar" + ícone de engrenagem).
- `frontend/src/components/ui/index.ts`: `Dialog*` e `Progress` adicionados ao barrel (primeiro
  consumo de ambos).
- `frontend/src/layouts/Sidebar.tsx`/`Topbar.tsx`: classes `sticky top-0` (ajuste pequeno de CSS).
- Testes E2E: `frontend/tests/e2e/projetos.spec.ts` precisa de atualização significativa (o fluxo
  de criação passa a abrir um modal, não mais um card inline) + novos testes para edição e busca
  em texto.

## Fora de escopo

- Excluir (delete) projeto — não pedido, e não há endpoint para isso.
- Edição em lote ou histórico de alterações (audit log) de um projeto.
- Campos `rodovia`/`km_inicial`/`km_final` separados (decisão 2 acima).
- Qualquer mudança em `RdoPage.tsx` ou `ConfiguracaoPage.tsx`.
