# Histórico & Aprovações — Design

## Contexto

O MVP original (`specs/001-mvp-gestao-diaria/spec.md`) deixou explícito em
Clarifications e Assumptions que o RDO nasceria e ficaria visível sem nenhum
workflow de aprovação: "Fica no backlog." O protótipo funcional de referência
(`EPR_Daily_Completo.html`, bloco 5.2) já define esse fluxo completo: todo RDO
enviado nasce "Aguardando Aprovação" e só vira dado oficial quando o fiscal
designado aprova (ou é rejeitado, com motivo).

O modelo `RegistroDiario` já tem um campo `fiscal` (FK para `User`, escolhido
por RDO a partir de uma lista de fiscais cadastrados — não necessariamente
perfil Gerente) e a listagem já suporta filtro por mês (`?mes=YYYY-MM`). RDOs
não são editáveis via API hoje (só list/create/retrieve).

## Decisões confirmadas

1. **Quem aprova**: só o usuário igual a `registro.fiscal` — não qualquer
   Gerente. É o mesmo fluxo do protótipo ("vai para X aprovar").
2. **Escopo do efeito**: Dashboard e Custos & Ociosidade continuam somando
   todos os RDOs, independente de status, nesta primeira rodada. O status de
   aprovação fica isolado nesta tela nova.
3. **Retroatividade**: RDOs já existentes no banco recebem `status='aprovado'`
   na migração — não entram artificialmente numa fila de pendências.
4. **Rejeição é terminal**: sem fluxo de reenvio/edição nesta rodada — RDO
   continua não-editável. Corrigir um RDO rejeitado significa criar um novo
   (fora de escopo desta spec).
5. **Escopo da tela**: por projeto, como Custos & Ociosidade — não uma fila
   cross-projeto do fiscal.
6. **Visibilidade da tela**: aberta a todos os perfis (Gerente e Auxiliar
   administrativo), sem gate de perfil. Os botões de Aprovar/Rejeitar só
   aparecem quando o usuário logado é o fiscal daquele RDO específico — e o
   backend também impede a ação via 403 para qualquer outro usuário.

## Arquitetura

Estende o app `registros_diarios` existente — ele já é dono do
`RegistroDiario`, e a mutação de status pertence a esse domínio. Diferente de
Custos & Ociosidade (app novo, só leitura), este módulo escreve no próprio
RDO usando actions REST na viewset existente.

## Schema (`registros_diarios/models.py`)

Três campos novos em `RegistroDiario`:

- `status` — `CharField(max_length=24, choices=StatusRegistroChoices.choices,
  default=StatusRegistroChoices.AGUARDANDO_APROVACAO)`, com
  `StatusRegistroChoices` (`aguardando_aprovacao` / `aprovado` /
  `rejeitado`).
- `motivo_rejeicao` — `TextField(blank=True)`, preenchido só em rejeição.
- `aprovado_em` — `DateTimeField(null=True, blank=True)`, timestamp da
  decisão do fiscal (aprovação OU rejeição — nome mantido curto, seguindo o
  protótipo que usa o mesmo campo `aprovadoEm` para ambos os casos).

Migração de dados: `RunPython` atualiza todo `RegistroDiario` existente para
`status='aprovado'` (registros criados antes deste campo existir já eram
tratados como dado oficial, sem workflow).

## Regras de negócio (`services.py`)

Nova função `transicionar_status_registro(*, registro, novo_status, usuario,
motivo_rejeicao="")`:

- Levanta `ValidationError` se `registro.status != AGUARDANDO_APROVACAO`
  ("Este RDO já foi analisado.").
- Levanta `ValidationError` se `novo_status == REJEITADO` e
  `motivo_rejeicao` vazio ("Informe o motivo da rejeição.").
- Levanta `PermissionDenied` se `usuario.id != registro.fiscal_id` ("Só o
  fiscal designado pode aprovar ou rejeitar este RDO.") — mapeada para 403,
  não 404: o RDO é visível a todos na mesma empresa, a restrição é de ação,
  não de isolamento de tenant (Princípio I continua reservado para
  cross-empresa).
- Em sucesso: define `status`, `motivo_rejeicao` (se aplicável) e
  `aprovado_em = timezone.now()`, salva e retorna o registro atualizado.

## API

Duas novas actions em `RegistroDiarioViewSet`:

- `POST /projetos/{projeto_pk}/registros-diarios/{id}/aprovar/` — sem body.
- `POST /projetos/{projeto_pk}/registros-diarios/{id}/rejeitar/` — body
  `{"motivo_rejeicao": "..."}`.

Ambas chamam `services.transicionar_status_registro`, retornam o
`RegistroDiarioSerializer` atualizado (200) ou o erro apropriado (400/403).

`RegistroDiarioSerializer` ganha `status`, `motivo_rejeicao`, `aprovado_em`
como `read_only_fields` — nunca setáveis via payload de criação.

Sem endpoint novo de listagem/KPI: a tela reaproveita
`GET /projetos/{id}/registros-diarios/?mes=YYYY-MM`, que já existe. KPIs
(aguardando/aprovados/rejeitados/taxa de aprovação) são calculados no
frontend a partir da lista do mês — mesmo padrão do protótipo, que calcula
tudo em cima do array `RDOS` já carregado.

## Frontend

- Nova página `HistoricoAprovacoesPage.tsx`, rota
  `/projetos/:projetoId/historico-aprovacoes`.
- Novo item no `Sidebar.tsx`, visível para todos os perfis, ao lado de
  "Registros diários" (sem gate, ao contrário do item de Custos &
  Ociosidade).
- Seletor de mês (`<input type="month">`, reaproveitando
  `useRegistrosDiarios(projetoId, {mes})` já existente).
- 4 tiles de KPI: Aguardando aprovação, Aprovados, Rejeitados, Taxa de
  aprovação (`aprovados / (aprovados + rejeitados) * 100`, ou 100% se ainda
  não houver nenhum avaliado — mesma fórmula do protótipo).
- Chips de filtro por status: Todos / Aguardando / Aprovados / Rejeitados
  (filtragem client-side sobre a lista já carregada).
- Cards expansíveis por RDO mostrando: equipe, data, resumo de produção,
  status badge colorido, e ao expandir: fiscal responsável, enviado em
  (`created_at`), decidido em (`aprovado_em`, rotulado "Aprovado em" ou
  "Rejeitado em" conforme o status) e motivo de rejeição quando houver.
- Quando `status === 'aguardando_aprovacao'` E `user.id === registro.fiscal`:
  mostra botões "Aprovar RDO" e "Rejeitar". Rejeitar abre uma textarea de
  motivo com "Confirmar rejeição" / "Cancelar" antes de submeter — mesma UX
  do protótipo.
- Dois novos hooks de mutation em `registrosDiariosApi.ts`:
  `useAprovarRegistroDiario(projetoId)` e
  `useRejeitarRegistroDiario(projetoId)`, cada um invalidando a query de
  listagem do projeto ao concluir com sucesso.
- Novo tipo `StatusRegistro` (`'aguardando_aprovacao' | 'aprovado' |
  'rejeitado'`) e campos `status`, `motivo_rejeicao`, `aprovado_em` em
  `RegistroDiario` (`types/registroDiario.ts`).

## Testes

- Backend (`registros_diarios/tests/`):
  - `transicionar_status_registro`: aprovação bem-sucedida define status e
    `aprovado_em`; rejeição exige motivo; RDO já decidido não pode ser
    re-decidido; usuário que não é o fiscal recebe `PermissionDenied`.
  - API: fiscal aprova via `POST .../aprovar/` → 200 e status atualizado;
    fiscal rejeita sem motivo → 400; outro usuário da mesma empresa tenta
    aprovar → 403; usuário de outra empresa tenta acessar o RDO → 404
    (isolamento de tenant já coberto pelo mixin existente).
  - Migração: RDO criado antes da migração de dados é verificado com
    `status='aprovado'` (teste de migração ou verificação manual documentada,
    seguindo o precedente já usado em Custos & Ociosidade).
- Frontend (e2e): usuário logado como fiscal vê e usa os botões de
  Aprovar/Rejeitar num RDO pendente; usuário que não é o fiscal do RDO não vê
  os botões; rejeitar sem preencher motivo mantém o botão de confirmar
  desabilitado ou mostra erro; KPIs e filtro por status refletem o novo
  status após a ação.

## Fora de escopo

- Reenvio/edição de RDO rejeitado.
- Fila cross-projeto do fiscal (ver todos os RDOs pendentes de todos os
  projetos numa tela só).
- Dashboard e Custos & Ociosidade passarem a filtrar por status de
  aprovação.
- Qualquer novo perfil "Fiscal" — o campo `fiscal` continua sendo qualquer
  `User` da empresa escolhido por RDO, como já funciona hoje.
