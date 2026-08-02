# Medição — Design

## Contexto

A EAP hoje já carrega `CatalogoServico.preco_unitario` e `Disciplina.valor_base` (adicionados pela importação hierárquica, `docs/superpowers/specs/2026-08-01-eap-importacao-hierarquica-valor-design.md`), e `buildflow.projetos.services.calcular_quantidade_executada_total` já soma a produção diária aprovada de RDO por serviço. Nenhuma dessas peças hoje vira valor faturável — este módulo fecha esse ciclo.

**Medição** é um boletim periódico por projeto: numa data de corte escolhida, congela a quantidade executada acumulada de cada serviço, calcula o delta em relação à última medição aprovada, multiplica pelo preço unitário, e passa por aprovação de um fiscal designado — mesmo padrão de aprovação já usado no RDO (`RegistroDiario.fiscal`).

## Escopo

**Dentro do escopo:**
- Model `Medicao` (cabeçalho do boletim) + `ItemMedicao` (linha por serviço), em um app novo `medicoes`.
- Cálculo acumulado com desconto da medição anterior aprovada (não período fechado por datas).
- Geração automática: todos os serviços do projeto com quantidade executada não-nula entram, sem seleção manual.
- Fluxo de aprovação com fiscal designado por medição (aprovar/rejeitar/cancelar), mesmo modelo do RDO.
- Trava de uma medição pendente por vez, por projeto.
- Serviço sem `preco_unitario` entra no boletim com valor nulo, sem bloquear a medição.
- Generalização de `calcular_quantidade_executada_total` para aceitar um corte de data opcional.
- Telas de lista e detalhe por projeto, navegação lateral própria.

**Fora do escopo:**
- Exportação em PDF do boletim — só tela nesta rodada.
- Seleção manual de quais serviços/disciplinas entram em cada medição — sempre todos.
- Edição de uma medição já criada — só aprovar, rejeitar ou cancelar (enquanto pendente).
- Qualquer papel de "cliente"/aprovador externo — aprovação continua interna, via fiscal designado (usuário do sistema).
- Uso de `Disciplina.valor_base` — é um valor de referência importado à parte, sem relação validada com a soma dos serviços (a spec de importação hierárquica já deixa isso explícito), e não entra no cálculo da medição.
- Medição por período fechado (data início/fim) — só o modelo acumulado com desconto da anterior.

## Modelo de dados

App novo `medicoes` (mesmo padrão de app dedicado que RDO e RNC já seguem, apesar de dependerem de `configuracoes`/`projetos`).

### `Medicao`

Cabeçalho do boletim.

- `id`: `UUIDField`, `primary_key=True`, `default=uuid.uuid4`.
- `projeto`: FK `Projeto`, `on_delete=CASCADE`, `related_name="medicoes"`.
- `data_corte`: `DateField` — data até a qual a quantidade executada é acumulada.
- `fiscal`: FK `settings.AUTH_USER_MODEL`, `on_delete=PROTECT`, `related_name="medicoes_como_fiscal"` — só ele pode aprovar/rejeitar esta medição.
- `criado_por`: FK `settings.AUTH_USER_MODEL`, `on_delete=PROTECT`, `related_name="medicoes_criadas"`.
- `status`: `CharField`, `choices` de `StatusMedicaoChoices` (`aguardando_aprovacao`, `aprovado`, `rejeitado`), default `aguardando_aprovacao`.
- `motivo_rejeicao`: `TextField`, `blank=True`.
- `aprovado_em`: `DateTimeField`, `null=True, blank=True`.
- `created_at`: `DateTimeField`, `auto_now_add=True`.
- `tenant_path = "projeto__empresa"`, `objects = TenantScopedManager()`.

Constraint: no máximo uma `Medicao` por projeto com `status="aguardando_aprovacao"` — `UniqueConstraint(fields=["projeto"], condition=Q(status="aguardando_aprovacao"), name="medicao_pendente_unica_por_projeto")`.

### `ItemMedicao`

Uma linha por `CatalogoServico` incluído no boletim.

- `id`: `UUIDField`, `primary_key=True`, `default=uuid.uuid4`.
- `medicao`: FK `Medicao`, `on_delete=CASCADE`, `related_name="itens"`.
- `servico`: FK `CatalogoServico`, `on_delete=PROTECT` (preserva o histórico financeiro mesmo se o serviço for removido depois).
- `quantidade_acumulada`: `DecimalField(max_digits=12, decimal_places=3)` — total executado até `data_corte`.
- `quantidade_anterior`: `DecimalField(max_digits=12, decimal_places=3)` — `quantidade_acumulada` da última medição aprovada anterior (`0` se não houver nenhuma).
- `quantidade_periodo`: `DecimalField(max_digits=12, decimal_places=3)` — `quantidade_acumulada - quantidade_anterior`.
- `preco_unitario_snapshot`: `DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)` — cópia de `servico.preco_unitario` no momento da criação.
- `valor_periodo`: `DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)` — `quantidade_periodo * preco_unitario_snapshot`, nulo quando `preco_unitario_snapshot` é nulo.
- `tenant_path = "medicao__projeto__empresa"`, `objects = TenantScopedManager()`.

Todos os campos numéricos de `ItemMedicao` são snapshots imutáveis tirados na criação da `Medicao` — nunca recalculados depois, mesmo que RDOs sejam re-aprovados ou o preço do serviço mude posteriormente. Isso torna a medição um registro financeiro auditável, não uma view derivada.

## Cálculo e criação

### Generalização de `calcular_quantidade_executada_total`

Hoje (`backend/buildflow/projetos/services.py`):

```python
def calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal:
    soma_rdo = ProducaoDiaria.objects.filter(
        servico=servico,
        registro_diario__status=StatusRegistroChoices.APROVADO,
    ).aggregate(total=Sum("quantidade"))["total"] or Decimal("0")
    return servico.quantidade_executada_manual + soma_rdo
```

Passa a aceitar um corte de data opcional, sem mudar o comportamento default (todos os chamadores existentes continuam somando tudo):

```python
def calcular_quantidade_executada_total(
    servico: CatalogoServico,
    ate: datetime.date | None = None,
) -> Decimal:
    filtros = {
        "servico": servico,
        "registro_diario__status": StatusRegistroChoices.APROVADO,
    }
    if ate is not None:
        filtros["registro_diario__data_referencia__lte"] = ate
    soma_rdo = ProducaoDiaria.objects.filter(**filtros).aggregate(
        total=Sum("quantidade"),
    )["total"] or Decimal("0")
    return servico.quantidade_executada_manual + soma_rdo
```

`quantidade_executada_manual` (ajuste manual, sem data associada) sempre entra no total, independente do corte — mesma semântica já usada em `calcular_avanco_servico`.

### `criar_medicao(projeto, data_corte, fiscal, criado_por) -> Medicao`

Novo serviço em `backend/buildflow/medicoes/services.py`, transacional:

1. **Precondição de pendência**: se `Medicao.objects.filter(projeto=projeto, status=AGUARDANDO_APROVACAO).exists()`, erro (`MedicaoInvalida`, mesmo padrão de exceção nomeada que `ArquivoInvalido` já estabelece): "Este projeto já possui uma medição aguardando aprovação. Aprove ou rejeite antes de criar outra."
2. **Precondição de data**: busca a última `Medicao` do projeto com `status=APROVADO` (`order_by("-data_corte").first()`). Se existir e `data_corte <= ultima_aprovada.data_corte`, erro: "A data de corte deve ser posterior à da última medição aprovada ({data})." Se `data_corte > date.today()`, erro: "A data de corte não pode ser no futuro."
3. **Base de comparação**: `quantidade_anterior` de cada serviço vem dos `ItemMedicao` da última medição aprovada (indexados por `servico_id`); serviço ausente nela (não existia ainda, ou não tinha quantidade) → `quantidade_anterior=0`.
4. **Iteração**: para cada `CatalogoServico` do projeto (`CatalogoServico.objects.filter(disciplina__projeto=projeto)`), calcula `quantidade_acumulada = calcular_quantidade_executada_total(servico, ate=data_corte)`. Se `quantidade_acumulada == 0` e `quantidade_anterior == 0`, pula (não cria `ItemMedicao`) — evita boletins com dezenas de linhas zeradas em projetos recém-iniciados.
5. Para os demais: `quantidade_periodo = quantidade_acumulada - quantidade_anterior`; `preco_unitario_snapshot = servico.preco_unitario`; `valor_periodo = quantidade_periodo * preco_unitario_snapshot` se o preço não for nulo, senão `None`.
6. Grava `Medicao` + todos os `ItemMedicao` em uma única `transaction.atomic()`.

`quantidade_periodo` nunca é negativo por construção: `quantidade_acumulada` (executado até uma data mais recente) é sempre ≥ `quantidade_anterior` (executado até uma data mais antiga), já que a produção só acumula.

## Fluxo de aprovação

Novo serviço `transicionar_status_medicao(medicao, novo_status, usuario, motivo_rejeicao="")`, mesmo padrão de `transicionar_status_registro` do RDO:

- Só permitido a partir de `status=AGUARDANDO_APROVACAO`.
- Só `usuario == medicao.fiscal` pode transicionar — qualquer outro usuário recebe 403 na view.
- Transição para `APROVADO`: seta `aprovado_em=timezone.now()`.
- Transição para `REJEITADO`: exige `motivo_rejeicao` não vazio (erro de validação caso contrário).
- Uma medição rejeitada **não** vira base para a próxima — a próxima `criar_medicao` continua comparando contra a última com `status=APROVADO` (ou zero, se nunca houve uma). A rejeitada permanece como registro histórico do que foi proposto e recusado.

### Cancelamento

`cancelar_medicao(medicao, usuario)`: permitido só enquanto `status=AGUARDANDO_APROVACAO`, só para `usuario == medicao.criado_por` ou usuário com permissão de Gerente. Deleta a `Medicao` (cascade nos `ItemMedicao`) — libera a trava de "uma pendente por projeto" sem exigir aprovação formal para desfazer um engano de criação (ex.: data de corte errada).

## API

Novo app `medicoes`, rotas aninhadas em projeto — mesmo padrão de `configuracoes`/`registros_diarios` (`ProjetoNestedMixin`, permissão `IsAuthenticatedWithEmpresa` em todas, mais as específicas abaixo):

- `POST /projetos/<uuid:projeto_pk>/medicoes/` — `IsGerente`. Body: `{"data_corte": "YYYY-MM-DD", "fiscal": "<uuid do usuário>"}`. 201 com a medição completa (itens inclusos) serializada, ou 400 com `{"detail": "..."}` para os erros de `MedicaoInvalida`.
- `GET /projetos/<uuid:projeto_pk>/medicoes/` — lista, `order_by("-data_corte")`. Campos resumidos: `id`, `data_corte`, `status`, `fiscal` (nome), `valor_total` (soma de `valor_periodo` não-nulos dos itens), `quantidade_itens_sem_preco`.
- `GET /projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/` — detalhe completo, com lista de itens (`servico.nome`, `servico.disciplina.nome`, `quantidade_anterior`, `quantidade_acumulada`, `quantidade_periodo`, `preco_unitario_snapshot`, `valor_periodo`), mais `valor_total` e `quantidade_itens_sem_preco`.
- `POST /projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/aprovar/` — só `request.user == medicao.fiscal` (403 caso contrário). 200 com a medição atualizada.
- `POST /projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/rejeitar/` — mesma checagem de fiscal; body `{"motivo_rejeicao": "..."}` obrigatório (400 se vazio).
- `DELETE /projetos/<uuid:projeto_pk>/medicoes/<uuid:pk>/` — só enquanto `aguardando_aprovacao`; só `criado_por` ou Gerente (403 caso contrário); 400 se a medição já não estiver mais pendente.

`valor_total` e `quantidade_itens_sem_preco` são calculados no serializer a partir dos itens, nunca armazenados.

## UI

Novo item de navegação lateral "Medições" por projeto, mesmo nível hierárquico de RDO/RNC/Custos & Ociosidade.

**Lista** (`/projetos/:projetoId/medicoes`, `MedicoesListPage.tsx`): tabela com data de corte, status (`AppStatusBadge`, reaproveitando o componente já extraído), fiscal, valor total formatado (reaproveitando `frontend/src/lib/format.ts`). Botão "Nova medição" abre modal com dois campos: data de corte (date picker, default hoje) e fiscal (select de usuários da empresa) — desabilitado com tooltip explicando o motivo quando já existe uma medição pendente no projeto.

**Detalhe** (`/projetos/:projetoId/medicoes/:medicaoId`, `MedicaoDetailPage.tsx`): cabeçalho com status, fiscal, data de corte, data de criação. Tabela de itens: serviço, disciplina, quantidade anterior, quantidade acumulada, quantidade do período, preço unitário, valor do período (linha sem preço mostra "—" no valor, com indicação visual sutil de que não entra no total). Total geral em destaque, com nota se `quantidade_itens_sem_preco > 0` ("N serviços sem preço não entram no total"). Botões "Aprovar"/"Rejeitar" visíveis só para o fiscal designado quando `status=aguardando_aprovacao` (mesmo padrão condicional de visibilidade que `RegistroDiarioDetailPage` já usa para aprovação de RDO); rejeitar abre modal pedindo o motivo. Botão "Cancelar" visível para o criador ou Gerente, mesma condição de status.

## Testes esperados

**Nível serviço (`medicoes/services.py`):**
- `criar_medicao`: primeira medição do projeto parte de base zero para todos os serviços.
- Segunda medição usa os `ItemMedicao` da primeira (aprovada) como `quantidade_anterior`.
- Bloqueio de criação com medição pendente já existente.
- Bloqueio de data de corte não-posterior à última aprovada, e de data no futuro.
- Serviço sem `preco_unitario`: item criado com `preco_unitario_snapshot=None` e `valor_periodo=None`, não conta no `valor_total`.
- Serviço sem nenhuma quantidade executada (nem antes, nem até o corte): não gera `ItemMedicao`.
- `calcular_quantidade_executada_total(servico, ate=data)`: filtra corretamente por data; chamada sem `ate` mantém o comportamento atual (regressão para os chamadores existentes: `calcular_avanco_servico`, etc.).

**Aprovação:**
- Só o fiscal designado consegue aprovar/rejeitar; outro usuário recebe erro de permissão.
- Rejeição sem `motivo_rejeicao` é rejeitada com erro de validação.
- Medição rejeitada não vira base da próxima `criar_medicao` (a próxima ainda usa a última aprovada, ou zero).
- Cancelamento: só enquanto pendente, só criador/Gerente; medição e itens são removidos.

**Nível API:**
- Fluxo completo: criar → listar → detalhar → aprovar, com os valores corretos na resposta.
- 403 ao tentar aprovar/rejeitar/cancelar sem permissão.
- 400 com mensagem clara nos casos de `MedicaoInvalida` (pendente duplicada, data inválida).

**Antes do merge:** teste manual no browser — criar duas medições sucessivas num projeto real com RDOs aprovados e serviços precificados (reaproveitando o projeto de teste já usado na verificação da importação hierárquica), conferindo visualmente que o delta e o valor batem com o esperado.
