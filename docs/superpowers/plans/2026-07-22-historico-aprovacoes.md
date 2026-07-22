# Histórico & Aprovações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar workflow de aprovação ao RDO existente — todo `RegistroDiario` nasce "Aguardando Aprovação" e só o fiscal designado pode aprová-lo ou rejeitá-lo (com motivo obrigatório na rejeição), com uma nova tela "Histórico & Aprovações" por projeto.

**Architecture:** Estende o app `registros_diarios` já existente (dono do `RegistroDiario`) em vez de criar um app novo — este módulo escreve no próprio RDO via duas novas actions REST (`aprovar`/`rejeitar`) na viewset já existente, não é somente-leitura como Custos & Ociosidade.

**Tech Stack:** Django REST Framework, pytest + pytest-django + factory_boy (backend); React + TanStack Query + React Router + Tailwind + shadcn/radix components (frontend); Playwright (e2e).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-22-historico-aprovacoes-design.md` — todas as 6 decisões confirmadas lá são vinculantes (só o fiscal designado aprova; Dashboard/Custos & Ociosidade não mudam; RDOs antigos migram para `aprovado`; rejeição é terminal, sem reenvio; tela por projeto; tela visível a todos os perfis).
- Princípio I (isolamento multitenant): qualquer recurso vinculado a uma Empresa retorna 404 — nunca 403 — para usuário de outra empresa. Já garantido pelo `TenantScopedViewSetMixin` existente; não alterar esse comportamento.
- Django `ValidationError` (`django.core.exceptions`) precisa ser convertida manualmente para `rest_framework.exceptions.ValidationError` nas views (não há conversão automática do DRF) — padrão já usado em `FotoUploadView.create()` (`registros_diarios/views.py:105-117`). `django.core.exceptions.PermissionDenied`, ao contrário, **já é convertida automaticamente pelo DRF para HTTP 403** — não precisa de try/except nas views.
- Backend: rodar testes com `DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest` (bare `uv run pytest` falha na coleta por um problema pré-existente e não relacionado em `pyproject.toml`). Lint: `uv run ruff check .` e `uv run ruff format --check .`.
- Frontend: `npm run build` (inclui `tsc -b`), `npm run lint` (oxlint), `npx playwright test <arquivo>` para e2e específico.
- Sem tratamento de erro para cenários impossíveis; sem abstrações prematuras; nomes em português, seguindo o padrão já usado no restante do app (`registro_diario`, `fiscal`, `aprovado_em`, etc.).

---

### Task 1: Schema + regra de transição de status (backend)

**Files:**
- Modify: `backend/buildflow/registros_diarios/models.py`
- Create: `backend/buildflow/registros_diarios/migrations/0002_registrodiario_status_and_more.py` (nome exato depende do `makemigrations` — ver Step 3)
- Create: `backend/buildflow/registros_diarios/migrations/0003_marcar_rdos_existentes_como_aprovados.py`
- Modify: `backend/buildflow/registros_diarios/services.py`
- Create: `backend/buildflow/registros_diarios/tests/test_transicao_status.py`

**Interfaces:**
- Produces: `StatusRegistroChoices` (`registros_diarios/models.py`) com valores `AGUARDANDO_APROVACAO = "aguardando_aprovacao"`, `APROVADO = "aprovado"`, `REJEITADO = "rejeitado"`. `RegistroDiario.status` (default `AGUARDANDO_APROVACAO`), `RegistroDiario.motivo_rejeicao` (`TextField`, blank), `RegistroDiario.aprovado_em` (`DateTimeField`, null). `services.transicionar_status_registro(*, registro: RegistroDiario, novo_status: str, usuario, motivo_rejeicao: str = "") -> RegistroDiario` — usado por Task 2.

- [ ] **Step 1: Adicionar `StatusRegistroChoices` e os três campos novos ao model**

Em `backend/buildflow/registros_diarios/models.py`, adicionar a choice class logo depois de `OrigemChoices` (linha ~64):

```python
class StatusRegistroChoices(models.TextChoices):
    AGUARDANDO_APROVACAO = "aguardando_aprovacao", _("Aguardando Aprovação")
    APROVADO = "aprovado", _("Aprovado")
    REJEITADO = "rejeitado", _("Rejeitado")
```

Atualizar a docstring da classe `RegistroDiario` (ela hoje afirma o contrário do que este plano implementa):

```python
class RegistroDiario(models.Model):
    """RDO — relato de um dia de trabalho em um projeto.

    Todo RDO nasce "Aguardando Aprovação" e só o fiscal designado (campo
    `fiscal`) pode aprová-lo ou rejeitá-lo — ver `services.transicionar_status_registro`.
    """
```

Adicionar os três campos novos logo após o campo `atualizado_por` (antes de `created_at`):

```python
    status = models.CharField(
        _("status"),
        max_length=24,
        choices=StatusRegistroChoices.choices,
        default=StatusRegistroChoices.AGUARDANDO_APROVACAO,
    )
    motivo_rejeicao = models.TextField(_("motivo da rejeição"), blank=True)
    aprovado_em = models.DateTimeField(_("aprovado em"), null=True, blank=True)
```

- [ ] **Step 2: Gerar a migração de schema**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py makemigrations registros_diarios`
Expected: cria um arquivo `migrations/000N_registrodiario_status_..._and_more.py` com três operações `AddField` (`status`, `motivo_rejeicao`, `aprovado_em`). Anote o nome exato do arquivo gerado — ele vira a dependency da migração de dados no próximo passo.

- [ ] **Step 3: Criar a migração de dados para RDOs já existentes**

Todo `RegistroDiario` criado antes deste campo existir já era tratado como dado oficial (sem workflow) — a migração de schema do Step 2 aplicaria `aguardando_aprovacao` a eles por causa do `default`, o que é errado. Criar `backend/buildflow/registros_diarios/migrations/000{N+1}_marcar_rdos_existentes_como_aprovados.py` (substitua `000{N+1}` e a dependency pelo nome real gerado no Step 2):

```python
from django.db import migrations


def marcar_rdos_existentes_como_aprovados(apps, schema_editor):
    RegistroDiario = apps.get_model("registros_diarios", "RegistroDiario")
    RegistroDiario.objects.update(status="aprovado")


class Migration(migrations.Migration):

    dependencies = [
        ("registros_diarios", "000N_registrodiario_status_..._and_more"),
    ]

    operations = [
        migrations.RunPython(
            marcar_rdos_existentes_como_aprovados,
            migrations.RunPython.noop,
        ),
    ]
```

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run python manage.py migrate registros_diarios`
Expected: as duas migrações aplicam sem erro.

- [ ] **Step 4: Escrever os testes (falhando) da regra de transição de status**

Criar `backend/buildflow/registros_diarios/tests/test_transicao_status.py`:

```python
import pytest
from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios import services
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.models import StatusRegistroChoices

from .factories import EquipeFactory
from .factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db


def _criar_rdo(*, fiscal, autor=None):
    projeto = ProjetoParaRdoFactory(criado_por=autor or fiscal)
    equipe = EquipeFactory(projeto=projeto)
    return RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia="2026-07-17",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=fiscal,
        autor=autor or fiscal,
    )


def test_novo_rdo_nasce_aguardando_aprovacao():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    assert registro.status == StatusRegistroChoices.AGUARDANDO_APROVACAO
    assert registro.aprovado_em is None


def test_aprovacao_define_status_e_aprovado_em():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.APROVADO,
        usuario=fiscal,
    )

    registro.refresh_from_db()
    assert registro.status == StatusRegistroChoices.APROVADO
    assert registro.aprovado_em is not None


def test_rejeicao_sem_motivo_levanta_erro():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    with pytest.raises(ValidationError):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.REJEITADO,
            usuario=fiscal,
            motivo_rejeicao="",
        )


def test_rejeicao_com_motivo_grava_motivo_e_status():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)

    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.REJEITADO,
        usuario=fiscal,
        motivo_rejeicao="Faltam fotos do trecho.",
    )

    registro.refresh_from_db()
    assert registro.status == StatusRegistroChoices.REJEITADO
    assert registro.motivo_rejeicao == "Faltam fotos do trecho."


def test_rdo_ja_analisado_nao_pode_ser_reanalisado():
    fiscal = UsuarioFactory()
    registro = _criar_rdo(fiscal=fiscal)
    services.transicionar_status_registro(
        registro=registro,
        novo_status=StatusRegistroChoices.APROVADO,
        usuario=fiscal,
    )

    with pytest.raises(ValidationError):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.REJEITADO,
            usuario=fiscal,
            motivo_rejeicao="Tentando de novo",
        )


def test_usuario_que_nao_e_fiscal_nao_pode_decidir():
    fiscal = UsuarioFactory()
    outro_usuario = UsuarioFactory(empresa=fiscal.empresa)
    registro = _criar_rdo(fiscal=fiscal)

    with pytest.raises(PermissionDenied):
        services.transicionar_status_registro(
            registro=registro,
            novo_status=StatusRegistroChoices.APROVADO,
            usuario=outro_usuario,
        )
```

- [ ] **Step 5: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_transicao_status.py -v`
Expected: `AttributeError: module 'buildflow.registros_diarios.services' has no attribute 'transicionar_status_registro'` em todos os testes exceto `test_novo_rdo_nasce_aguardando_aprovacao` (esse já passa, pois só depende do model do Step 1).

- [ ] **Step 6: Implementar `transicionar_status_registro`**

Em `backend/buildflow/registros_diarios/services.py`, adicionar ao topo os imports que faltam e a função no final do arquivo:

```python
from django.core.exceptions import PermissionDenied
from django.utils import timezone

from .models import RegistroDiario
from .models import StatusRegistroChoices
```

```python
def transicionar_status_registro(
    *,
    registro: RegistroDiario,
    novo_status: str,
    usuario,
    motivo_rejeicao: str = "",
) -> RegistroDiario:
    if usuario.id != registro.fiscal_id:
        msg = _("Só o fiscal designado pode aprovar ou rejeitar este RDO.")
        raise PermissionDenied(msg)
    if registro.status != StatusRegistroChoices.AGUARDANDO_APROVACAO:
        msg = _("Este RDO já foi analisado.")
        raise ValidationError(msg)
    if novo_status == StatusRegistroChoices.REJEITADO and not motivo_rejeicao:
        msg = _("Informe o motivo da rejeição.")
        raise ValidationError(msg)

    registro.status = novo_status
    registro.aprovado_em = timezone.now()
    if novo_status == StatusRegistroChoices.REJEITADO:
        registro.motivo_rejeicao = motivo_rejeicao
    registro.save(update_fields=["status", "aprovado_em", "motivo_rejeicao"])
    return registro
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_transicao_status.py -v`
Expected: 6 passed.

- [ ] **Step 8: Rodar a suíte completa do app e o lint**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/ -v && uv run ruff check . && uv run ruff format --check .`
Expected: todos os testes existentes do app continuam passando; ruff limpo.

- [ ] **Step 9: Commit**

```bash
git add backend/buildflow/registros_diarios/models.py backend/buildflow/registros_diarios/services.py backend/buildflow/registros_diarios/migrations/ backend/buildflow/registros_diarios/tests/test_transicao_status.py
git commit -m "feat: RDO ganha status de aprovacao e regra de transicao"
```

---

### Task 2: Actions de API (aprovar/rejeitar) + serializer

**Files:**
- Modify: `backend/buildflow/registros_diarios/serializers.py`
- Modify: `backend/buildflow/registros_diarios/views.py`
- Modify: `backend/buildflow/registros_diarios/urls.py`
- Create: `backend/buildflow/registros_diarios/tests/test_aprovacao_api.py`

**Interfaces:**
- Consumes: `services.transicionar_status_registro` (Task 1), `StatusRegistroChoices` (Task 1).
- Produces: `POST /api/v1/projetos/{projeto_pk}/registros-diarios/{pk}/aprovar/` e `POST /api/v1/projetos/{projeto_pk}/registros-diarios/{pk}/rejeitar/` (body `{"motivo_rejeicao": "..."}`), ambas retornando o `RegistroDiarioSerializer` atualizado. `RegistroDiarioSerializer` ganha os campos `status`, `motivo_rejeicao`, `aprovado_em` (read-only) — usados por Task 3/4 no frontend.

- [ ] **Step 1: Adicionar os campos novos ao serializer**

Em `backend/buildflow/registros_diarios/serializers.py`, na classe `RegistroDiarioSerializer`, atualizar `Meta`:

```python
    class Meta:
        model = RegistroDiario
        fields = [
            "id",
            "data_referencia",
            "turno",
            "clima",
            "equipe",
            "fiscal",
            "autor",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
            "updated_at",
            "producoes",
            "presencas",
            "maquinas",
            "ocorrencias",
            "fotos",
        ]
        read_only_fields = [
            "id",
            "autor",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
            "updated_at",
        ]
```

- [ ] **Step 2: Escrever os testes (falhando) das actions de API**

Criar `backend/buildflow/registros_diarios/tests/test_aprovacao_api.py`:

```python
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.models import RegistroDiario

from .factories import CatalogoServicoFactory
from .factories import DisciplinaFactory
from .factories import EquipeFactory
from .factories import ProjetoParaRdoFactory
from .factories import UnidadeFactory

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def cenario():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    disciplina = DisciplinaFactory(projeto=projeto)
    unidade = UnidadeFactory()
    servico = CatalogoServicoFactory(disciplina=disciplina, unidade=unidade)
    fiscal = UsuarioFactory(empresa=usuario.empresa)
    return {
        "usuario": usuario,
        "projeto": projeto,
        "equipe": equipe,
        "disciplina": disciplina,
        "servico": servico,
        "unidade": unidade,
        "fiscal": fiscal,
    }


def _payload(cenario_data):
    return {
        "data_referencia": "2026-07-17",
        "turno": "diurno",
        "clima": "sol",
        "equipe": str(cenario_data["equipe"].id),
        "fiscal": cenario_data["fiscal"].id,
        "producoes": [
            {
                "rodovia": "BR-365",
                "sentido": "crescente",
                "disciplina": str(cenario_data["disciplina"].id),
                "servico": str(cenario_data["servico"].id),
                "km_inicial": "10.000",
                "km_final": "10.500",
                "quantidade": "500.000",
                "unidade": cenario_data["unidade"].id,
            },
        ],
        "presencas": [],
        "maquinas": [],
        "ocorrencias": [],
    }


def _criar_rdo(cenario_data) -> str:
    url = f"/api/v1/projetos/{cenario_data['projeto'].id}/registros-diarios/"
    response = _authenticated_client(cenario_data["usuario"]).post(
        url,
        _payload(cenario_data),
        format="json",
    )
    assert response.status_code == HTTPStatus.CREATED, response.data
    return response.json()["id"]


def test_fiscal_aprova_rdo(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(url)

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["status"] == "aprovado"
    registro = RegistroDiario.objects.get(pk=registro_id)
    assert registro.aprovado_em is not None


def test_fiscal_rejeita_rdo_com_motivo(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/rejeitar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(
        url,
        {"motivo_rejeicao": "Faltam fotos do trecho."},
        format="json",
    )

    assert response.status_code == HTTPStatus.OK, response.data
    assert response.json()["status"] == "rejeitado"
    assert response.json()["motivo_rejeicao"] == "Faltam fotos do trecho."


def test_rejeitar_sem_motivo_retorna_400(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/rejeitar/"
    )

    response = _authenticated_client(cenario["fiscal"]).post(url, {}, format="json")

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_rdo_ja_decidido_nao_pode_ser_reanalisado(cenario):
    registro_id = _criar_rdo(cenario)
    url_aprovar = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )
    client = _authenticated_client(cenario["fiscal"])
    client.post(url_aprovar)

    response = client.post(url_aprovar)

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_usuario_que_nao_e_fiscal_recebe_403(cenario):
    registro_id = _criar_rdo(cenario)
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(cenario["usuario"]).post(url)

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_usuario_de_outra_empresa_recebe_404_ao_tentar_aprovar(cenario):
    registro_id = _criar_rdo(cenario)
    outro_usuario = UsuarioFactory()
    url = (
        f"/api/v1/projetos/{cenario['projeto'].id}/registros-diarios/"
        f"{registro_id}/aprovar/"
    )

    response = _authenticated_client(outro_usuario).post(url)

    assert response.status_code == HTTPStatus.NOT_FOUND
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_aprovacao_api.py -v`
Expected: todos falham com 404 (as rotas `aprovar`/`rejeitar` ainda não existem).

- [ ] **Step 4: Adicionar as actions na viewset**

Em `backend/buildflow/registros_diarios/views.py`, o arquivo já importa `from . import services`, `from django.core.exceptions import ValidationError as DjangoValidationError`, `from rest_framework.exceptions import ValidationError` e `from .models import RegistroDiario` (linhas 1-15) — nenhum desses precisa mudar. Adicionar só a linha que falta, junto do import existente de `.models`:

```python
from .models import StatusRegistroChoices
```

Adicionar os dois métodos na classe `RegistroDiarioViewSet`, depois de `list()`:

```python
    def aprovar(self, request, *args, **kwargs):
        registro = self.get_object()
        try:
            services.transicionar_status_registro(
                registro=registro,
                novo_status=StatusRegistroChoices.APROVADO,
                usuario=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(registro).data)

    def rejeitar(self, request, *args, **kwargs):
        registro = self.get_object()
        try:
            services.transicionar_status_registro(
                registro=registro,
                novo_status=StatusRegistroChoices.REJEITADO,
                usuario=request.user,
                motivo_rejeicao=request.data.get("motivo_rejeicao", ""),
            )
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        return Response(self.get_serializer(registro).data)
```

`DjangoValidationError` e `ValidationError` já estão importados no topo do arquivo (mesmo padrão usado em `FotoUploadView.create()`, linhas 105-117). `django.core.exceptions.PermissionDenied` levantada dentro de `transicionar_status_registro` propaga sem try/except — o `exception_handler` padrão do DRF já a converte para HTTP 403.

- [ ] **Step 5: Registrar as rotas**

Em `backend/buildflow/registros_diarios/urls.py`, adicionar duas rotas novas depois da rota de listagem/criação:

```python
    path(
        "projetos/<uuid:projeto_pk>/registros-diarios/<uuid:pk>/aprovar/",
        RegistroDiarioViewSet.as_view({"post": "aprovar"}),
        name="registro-diario-aprovar",
    ),
    path(
        "projetos/<uuid:projeto_pk>/registros-diarios/<uuid:pk>/rejeitar/",
        RegistroDiarioViewSet.as_view({"post": "rejeitar"}),
        name="registro-diario-rejeitar",
    ),
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest buildflow/registros_diarios/tests/test_aprovacao_api.py -v`
Expected: 6 passed.

- [ ] **Step 7: Rodar a suíte completa do backend e o lint**

Run: `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest && uv run ruff check . && uv run ruff format --check .`
Expected: suíte inteira passando (nenhuma quebra em `test_api.py`/`test_validations.py`/`test_isolation.py` pelos campos novos no serializer — eles são aditivos); ruff limpo.

- [ ] **Step 8: Commit**

```bash
git add backend/buildflow/registros_diarios/serializers.py backend/buildflow/registros_diarios/views.py backend/buildflow/registros_diarios/urls.py backend/buildflow/registros_diarios/tests/test_aprovacao_api.py
git commit -m "feat: adiciona endpoints de aprovar/rejeitar RDO"
```

---

### Task 3: Tipos + hooks de API (frontend)

**Files:**
- Modify: `frontend/src/types/registroDiario.ts`
- Modify: `frontend/src/features/registros-diarios/registrosDiariosApi.ts`
- Modify: `frontend/src/lib/format.ts`

**Interfaces:**
- Consumes: endpoints `POST .../aprovar/` e `POST .../rejeitar/` (Task 2), campos `status`/`motivo_rejeicao`/`aprovado_em` no `RegistroDiarioSerializer` (Task 2).
- Produces: tipo `StatusRegistro`, `RegistroDiario.status`/`motivo_rejeicao`/`aprovado_em` (usados por Task 4). Hooks `useAprovarRegistroDiario(projetoId: string)` e `useRejeitarRegistroDiario(projetoId: string)` (usados por Task 4). `formatDataHora(iso: string | null): string` (usado por Task 4).

- [ ] **Step 1: Adicionar o tipo `StatusRegistro` e os campos novos em `RegistroDiario`**

Em `frontend/src/types/registroDiario.ts`, adicionar antes da interface `RegistroDiarioInput`:

```typescript
export type StatusRegistro = 'aguardando_aprovacao' | 'aprovado' | 'rejeitado'
```

Atualizar a interface `RegistroDiario` (no final do arquivo):

```typescript
export interface RegistroDiario extends RegistroDiarioInput {
  id: string
  autor: number
  status: StatusRegistro
  motivo_rejeicao: string
  aprovado_em: string | null
  created_at: string
  updated_at: string
  fotos: Foto[]
}
```

- [ ] **Step 2: Adicionar `formatDataHora` em `lib/format.ts`**

Em `frontend/src/lib/format.ts`, adicionar ao final:

```typescript
export function formatDataHora(iso: string | null): string {
  if (iso === null) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
```

- [ ] **Step 3: Adicionar os hooks de mutation**

Em `frontend/src/features/registros-diarios/registrosDiariosApi.ts`, adicionar ao final do arquivo:

```typescript
export function useAprovarRegistroDiario(projetoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (registroId: string) =>
      apiClient.post<RegistroDiario>(
        `/api/v1/projetos/${projetoId}/registros-diarios/${registroId}/aprovar/`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registros-diarios', projetoId] })
    },
  })
}

export function useRejeitarRegistroDiario(projetoId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ registroId, motivoRejeicao }: { registroId: string; motivoRejeicao: string }) =>
      apiClient.post<RegistroDiario>(
        `/api/v1/projetos/${projetoId}/registros-diarios/${registroId}/rejeitar/`,
        { motivo_rejeicao: motivoRejeicao },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['registros-diarios', projetoId] })
    },
  })
}
```

- [ ] **Step 4: Verificar que o projeto compila**

Run: `cd frontend && npm run build`
Expected: build sem erros de tipo.

- [ ] **Step 5: Lint**

Run: `cd frontend && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/registroDiario.ts frontend/src/features/registros-diarios/registrosDiariosApi.ts frontend/src/lib/format.ts
git commit -m "feat: tipos e hooks de aprovar/rejeitar RDO no frontend"
```

---

### Task 4: Página Histórico & Aprovações + navegação + e2e

**Files:**
- Create: `frontend/src/pages/HistoricoAprovacoesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Create: `frontend/tests/e2e/historico-aprovacoes.spec.ts`

**Interfaces:**
- Consumes: `useRegistrosDiarios`, `useAprovarRegistroDiario`, `useRejeitarRegistroDiario` (Task 3), `formatDataHora` (Task 3), `formatData` (`lib/format.ts`, já existente), `useAuth` (`features/auth/AuthContext`, já existente — `user.id: string`).

- [ ] **Step 1: Criar a página**

Criar `frontend/src/pages/HistoricoAprovacoesPage.tsx`:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, EmptyState, ErrorRetry, PageHeader, Skeleton, Textarea } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import {
  useAprovarRegistroDiario,
  useRegistrosDiarios,
  useRejeitarRegistroDiario,
} from '../features/registros-diarios/registrosDiariosApi'
import { toast } from '../hooks/use-toast'
import { formatData, formatDataHora } from '../lib/format'
import type { RegistroDiario, StatusRegistro } from '../types/registroDiario'

function mesAtualFiltro(): string {
  return new Date().toISOString().slice(0, 7)
}

const LABEL_STATUS: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
}

const COR_STATUS: Record<StatusRegistro, string> = {
  aguardando_aprovacao: 'border-amber-500 text-amber-600',
  aprovado: 'border-emerald-500 text-emerald-600',
  rejeitado: 'border-red-500 text-red-600',
}

const FILTROS_STATUS = ['', 'aguardando_aprovacao', 'aprovado', 'rejeitado'] as const

function HistoricoSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function TileHistorico({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-xl font-bold ${cor ?? 'text-ink'}`}>{valor}</p>
    </div>
  )
}

function calcularTaxaAprovacao(aprovados: number, rejeitados: number): number {
  const total = aprovados + rejeitados
  return total > 0 ? Math.round((aprovados / total) * 100) : 100
}

interface CardRegistroProps {
  registro: RegistroDiario
  souFiscal: boolean
  expandido: boolean
  rejeitando: boolean
  motivoTexto: string
  onToggleExpandir: () => void
  onIniciarRejeicao: () => void
  onCancelarRejeicao: () => void
  onMudarMotivo: (valor: string) => void
  onAprovar: () => void
  onConfirmarRejeicao: () => void
}

function CardRegistro({
  registro,
  souFiscal,
  expandido,
  rejeitando,
  motivoTexto,
  onToggleExpandir,
  onIniciarRejeicao,
  onCancelarRejeicao,
  onMudarMotivo,
  onAprovar,
  onConfirmarRejeicao,
}: CardRegistroProps) {
  const podeDecidir = souFiscal && registro.status === 'aguardando_aprovacao'

  return (
    <div className="mb-3 rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggleExpandir}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <div>
          <p className="font-medium text-ink">
            {formatData(registro.data_referencia)} · {registro.turno}
          </p>
          <p className="text-sm text-muted-foreground">{registro.clima}</p>
        </div>
        <span
          className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${COR_STATUS[registro.status]}`}
        >
          {LABEL_STATUS[registro.status]}
        </span>
      </button>

      {expandido && (
        <div className="border-t border-border p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Enviado em: </span>
            {formatDataHora(registro.created_at)}
          </p>
          {registro.aprovado_em && (
            <p>
              <span className="text-muted-foreground">
                {registro.status === 'rejeitado' ? 'Analisado em: ' : 'Aprovado em: '}
              </span>
              {formatDataHora(registro.aprovado_em)}
            </p>
          )}
          {registro.motivo_rejeicao && (
            <p className="mt-2 rounded-md bg-red-500/10 p-2 text-red-700">
              <strong>Motivo da rejeição:</strong> {registro.motivo_rejeicao}
            </p>
          )}

          {podeDecidir && (
            <div className="mt-4">
              {rejeitando ? (
                <div className="flex flex-col gap-2">
                  <Textarea
                    aria-label="Motivo da rejeição"
                    placeholder="Descreva o motivo da rejeição..."
                    value={motivoTexto}
                    onChange={(event) => onMudarMotivo(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={onConfirmarRejeicao}
                      disabled={!motivoTexto.trim()}
                    >
                      Confirmar rejeição
                    </Button>
                    <Button variant="outline" onClick={onCancelarRejeicao}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={onAprovar}>Aprovar RDO</Button>
                  <Button variant="outline" onClick={onIniciarRejeicao}>
                    Rejeitar
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HistoricoAprovacoesPage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [mes, setMes] = useState(mesAtualFiltro())
  const [filtroStatus, setFiltroStatus] = useState<StatusRegistro | ''>('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [rejeitandoId, setRejeitandoId] = useState<string | null>(null)
  const [motivoTexto, setMotivoTexto] = useState('')

  const registros = useRegistrosDiarios(projetoId ?? '', { mes })
  const aprovar = useAprovarRegistroDiario(projetoId ?? '')
  const rejeitar = useRejeitarRegistroDiario(projetoId ?? '')

  function alternarExpandir(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id))
    setRejeitandoId(null)
  }

  function iniciarRejeicao(id: string) {
    setRejeitandoId(id)
    setMotivoTexto('')
  }

  async function aprovarRdo(id: string) {
    try {
      await aprovar.mutateAsync(id)
      toast({ title: 'RDO aprovado.', variant: 'success' })
    } catch {
      toast({ title: 'Não foi possível aprovar o RDO.', variant: 'destructive' })
    }
  }

  async function confirmarRejeicao(id: string) {
    try {
      await rejeitar.mutateAsync({ registroId: id, motivoRejeicao: motivoTexto })
      setRejeitandoId(null)
      toast({ title: 'RDO rejeitado.', variant: 'success' })
    } catch {
      toast({ title: 'Não foi possível rejeitar o RDO.', variant: 'destructive' })
    }
  }

  const lista = registros.data?.results ?? []
  const aguardando = lista.filter((r) => r.status === 'aguardando_aprovacao').length
  const aprovados = lista.filter((r) => r.status === 'aprovado').length
  const rejeitados = lista.filter((r) => r.status === 'rejeitado').length
  const taxaAprovacao = calcularTaxaAprovacao(aprovados, rejeitados)
  const filtrados = filtroStatus ? lista.filter((r) => r.status === filtroStatus) : lista

  return (
    <main aria-label="Histórico e aprovações">
      <PageHeader
        title="Histórico & Aprovações"
        breadcrumbs={[{ label: 'Histórico & Aprovações' }]}
        actions={
          <input
            type="month"
            aria-label="Mês de referência"
            value={mes}
            onChange={(event) => setMes(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        }
      />

      {registros.isLoading && <HistoricoSkeleton />}

      {registros.isError && (
        <ErrorRetry
          message="Não foi possível carregar o histórico de RDOs."
          onRetry={() => void registros.refetch()}
        />
      )}

      {!registros.isLoading && !registros.isError && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <TileHistorico label="Aguardando aprovação" valor={String(aguardando)} cor="text-amber-600" />
            <TileHistorico label="Aprovados" valor={String(aprovados)} cor="text-emerald-600" />
            <TileHistorico label="Rejeitados" valor={String(rejeitados)} cor="text-red-600" />
            <TileHistorico label="Taxa de aprovação" valor={`${taxaAprovacao}%`} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {FILTROS_STATUS.map((valor) => (
              <Button
                key={valor || 'todos'}
                size="sm"
                variant={filtroStatus === valor ? 'default' : 'outline'}
                onClick={() => setFiltroStatus(valor)}
              >
                {valor === '' ? 'Todos' : LABEL_STATUS[valor]}
              </Button>
            ))}
          </div>

          <Card>
            {filtrados.length === 0 ? (
              <EmptyState>Nenhum RDO encontrado para esse filtro.</EmptyState>
            ) : (
              filtrados.map((registro) => (
                <CardRegistro
                  key={registro.id}
                  registro={registro}
                  souFiscal={String(registro.fiscal) === user?.id}
                  expandido={expandidoId === registro.id}
                  rejeitando={rejeitandoId === registro.id}
                  motivoTexto={motivoTexto}
                  onToggleExpandir={() => alternarExpandir(registro.id)}
                  onIniciarRejeicao={() => iniciarRejeicao(registro.id)}
                  onCancelarRejeicao={() => setRejeitandoId(null)}
                  onMudarMotivo={setMotivoTexto}
                  onAprovar={() => void aprovarRdo(registro.id)}
                  onConfirmarRejeicao={() => void confirmarRejeicao(registro.id)}
                />
              ))
            )}
          </Card>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Adicionar a rota em `App.tsx`**

Em `frontend/src/App.tsx`, adicionar o import (ordem alfabética, junto dos outros imports de `pages`):

```typescript
import { HistoricoAprovacoesPage } from './pages/HistoricoAprovacoesPage'
```

Adicionar a rota dentro do bloco `<Route element={<DashboardLayout />}>`, junto das outras rotas aninhadas em projeto:

```tsx
              <Route
                path="/projetos/:projetoId/historico-aprovacoes"
                element={<HistoricoAprovacoesPage />}
              />
```

- [ ] **Step 3: Adicionar o item no Sidebar**

Em `frontend/src/layouts/Sidebar.tsx`, importar o ícone `History` de `lucide-react` (adicionar ao import existente):

```typescript
import { DollarSign, FileText, History, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
```

Adicionar o `NavLink` logo depois do de "Registros diários" (sem gate de perfil — visível a todos):

```tsx
          <NavLink to={`/projetos/${projetoId}/historico-aprovacoes`} className={navItemClass}>
            <History size={18} aria-hidden="true" />
            Histórico & Aprovações
          </NavLink>
```

- [ ] **Step 4: Escrever os testes e2e**

Criar `frontend/tests/e2e/historico-aprovacoes.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const REGISTROS_URL = '**/api/v1/projetos/*/registros-diarios/**'

const FISCAL = {
  id: '1',
  email: 'fiscal@empresaA.example.com',
  nome: 'Fiscal Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const OUTRO_USUARIO = {
  id: '2',
  email: 'auxiliar@empresaA.example.com',
  nome: 'Auxiliar Empresa A',
  perfil: 'auxiliar_administrativo',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

function rdoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rdo-1',
    data_referencia: '2026-07-17',
    turno: 'diurno',
    clima: 'sol',
    equipe: 'equipe-1',
    fiscal: 1,
    autor: 2,
    status: 'aguardando_aprovacao',
    motivo_rejeicao: '',
    aprovado_em: null,
    created_at: '2026-07-17T18:42:00Z',
    updated_at: '2026-07-17T18:42:00Z',
    producoes: [],
    presencas: [],
    maquinas: [],
    ocorrencias: [],
    fotos: [],
    ...overrides,
  }
}

test('fiscal aprova um rdo aguardando aprovacao', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  let rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'POST' && url.endsWith('/aprovar/')) {
      rdo = { ...rdo, status: 'aprovado', aprovado_em: '2026-07-18T09:00:00Z' }
      return route.fulfill({ json: rdo })
    }
    return route.fulfill({ json: { results: [rdo] } })
  })

  await page.goto('/projetos/projeto-1/historico-aprovacoes')

  await expect(page.getByText('Aguardando Aprovação')).toBeVisible()
  await page.getByText('17/07/2026 · diurno').click()
  await page.getByRole('button', { name: 'Aprovar RDO' }).click()

  await expect(page.getByText('Aprovado', { exact: true })).toBeVisible()
})

test('usuario que nao e o fiscal nao ve botoes de decisao', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({
      json: { status: 200, data: { user: OUTRO_USUARIO }, meta: { is_authenticated: true } },
    }),
  )
  const rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => route.fulfill({ json: { results: [rdo] } }))

  await page.goto('/projetos/projeto-1/historico-aprovacoes')
  await page.getByText('17/07/2026 · diurno').click()

  await expect(page.getByRole('button', { name: 'Aprovar RDO' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Rejeitar' })).not.toBeVisible()
})

test('rejeitar exige motivo antes de confirmar', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  const rdo = rdoBase()
  await page.route(REGISTROS_URL, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: { ...rdo, status: 'rejeitado', motivo_rejeicao: 'Faltam fotos.' },
      })
    }
    return route.fulfill({ json: { results: [rdo] } })
  })

  await page.goto('/projetos/projeto-1/historico-aprovacoes')
  await page.getByText('17/07/2026 · diurno').click()
  await page.getByRole('button', { name: 'Rejeitar' }).click()

  const confirmar = page.getByRole('button', { name: 'Confirmar rejeição' })
  await expect(confirmar).toBeDisabled()

  await page.getByLabel('Motivo da rejeição').fill('Faltam fotos.')
  await expect(confirmar).toBeEnabled()
  await confirmar.click()

  await expect(page.getByText('Rejeitado', { exact: true })).toBeVisible()
})

test('kpis refletem as contagens do mes', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: FISCAL }, meta: { is_authenticated: true } } }),
  )
  const lista = [
    rdoBase({ id: 'rdo-1', status: 'aguardando_aprovacao' }),
    rdoBase({ id: 'rdo-2', status: 'aprovado', data_referencia: '2026-07-10' }),
    rdoBase({ id: 'rdo-3', status: 'rejeitado', data_referencia: '2026-07-05' }),
  ]
  await page.route(REGISTROS_URL, (route) => route.fulfill({ json: { results: lista } }))

  await page.goto('/projetos/projeto-1/historico-aprovacoes')

  await expect(page.getByText('Taxa de aprovação')).toBeVisible()
  await expect(page.getByText('50%')).toBeVisible()
})
```

- [ ] **Step 5: Rodar os testes e2e**

Run: `cd frontend && npx playwright test tests/e2e/historico-aprovacoes.spec.ts`
Expected: 4 passed.

- [ ] **Step 6: Rodar build + lint do frontend**

Run: `cd frontend && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/HistoricoAprovacoesPage.tsx frontend/src/App.tsx frontend/src/layouts/Sidebar.tsx frontend/tests/e2e/historico-aprovacoes.spec.ts
git commit -m "feat: adiciona pagina Historico & Aprovacoes (frontend)"
```

---

### Task 5: Documentação

**Files:**
- Modify: `specs/001-mvp-gestao-diaria/tasks.md`

**Interfaces:**
- Consumes: nada (task de documentação, sem interface de código).

- [ ] **Step 1: Adicionar entrada no changelog de `tasks.md`**

Ao final de `specs/001-mvp-gestao-diaria/tasks.md`, seguindo o mesmo formato das entradas anteriores (uma linha em branco antes, título em negrito com módulo + data, parágrafo descritivo, linha `**Verificado**:`), adicionar:

```markdown

**Backend + Frontend — Módulo Histórico & Aprovações (2026-07-22)**: segundo módulo da expansão de
escopo além do MVP, seguindo o protótipo `EPR_Daily_Completo.html` (bloco 5.2) e o item de backlog
já registrado em `specs/001-mvp-gestao-diaria/spec.md` (Clarifications/Assumptions: "sem workflow de
aprovação nesta versão"). `RegistroDiario` ganha `status` (`aguardando_aprovacao` default /
`aprovado` / `rejeitado`), `motivo_rejeicao` e `aprovado_em` — RDOs criados antes desta migração
foram marcados como `aprovado` (não entram numa fila de pendências artificial). Só o usuário igual
ao campo `fiscal` do RDO pode aprovar/rejeitar (`services.transicionar_status_registro`), via dois
novos endpoints na viewset existente: `POST .../registros-diarios/{id}/aprovar/` e `.../rejeitar/`
(motivo obrigatório na rejeição; RDO já decidido não pode ser reanalisado; outro usuário da mesma
empresa recebe 403; isolamento cross-empresa continua 404). Rejeição é terminal nesta rodada — RDO
continua não-editável, sem fluxo de reenvio. Nova página `HistoricoAprovacoesPage` (por projeto,
com filtro de mês e de status, KPIs de aguardando/aprovados/rejeitados/taxa de aprovação calculados
no frontend), visível a todos os perfis no Sidebar — os botões de decisão só aparecem para o
usuário que é o fiscal do RDO. Fora de escopo desta rodada: reenvio de RDO rejeitado, fila
cross-projeto do fiscal, e Dashboard/Custos & Ociosidade passarem a filtrar por status de aprovação
(continuam somando todos os RDOs, como antes).

**Verificado**: `DJANGO_SETTINGS_MODULE=config.settings.test uv run pytest` completo + `ruff check`
+ `ruff format --check` limpos; `npm run build` + `npm run lint` limpos; suíte e2e
`historico-aprovacoes.spec.ts` (4/4) passando.
```

- [ ] **Step 2: Commit**

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra modulo Historico & Aprovacoes em tasks.md"
```
