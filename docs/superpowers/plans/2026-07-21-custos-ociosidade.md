# Custos & Ociosidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo módulo somente-leitura que cruza dados já existentes (presença, apontamento de
máquina, valores de custo) para mostrar custo/déficit de mão de obra, custo/ociosidade de
máquinas e faltas por pessoa, por projeto e por mês — restrito ao perfil Gerente.

**Architecture:** `ValorCusto` (app `configuracoes`) ganha 2 campos opcionais (`funcao`,
`maquina`) para permitir atribuir custo por função/máquina individual. Novo app Django
`custos_ociosidade`, somente leitura, com um serviço de agregação puro (sem model próprio) e um
único endpoint `GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM`. Frontend ganha uma
página nova gated por `user.perfil === 'gerente'`, e a tela de Configurações → Valores ganha os
2 campos condicionais novos no formulário de criação.

**Tech Stack:** Django REST Framework, pytest, React 19 + TypeScript, TanStack Query, Playwright.

## Global Constraints

- `valor` em `ValorCusto` é **R$/dia** quando `tipo=mao_de_obra` e **R$/hora** quando
  `tipo=equipamento` — fixado nesta spec (campo existe desde o MVP mas nunca foi usado em nenhum
  cálculo até agora).
- `atestado` nunca entra em déficit financeiro (só `falta` gera déficit) — é só informativo.
- Nenhum cálculo nunca inventa número: sem `ValorCusto` correspondente, a linha entra nas
  contagens mas contribui R$ 0 (`tem_valor_cadastrado: false`); sem nenhuma hora registrada,
  eficiência retorna `null`, nunca `0`.
- Endpoint novo é **somente leitura** e restrito ao perfil `gerente` (403 para
  `auxiliar_administrativo`); projeto de outra empresa → 404 (nunca 403/detalhe).
- `mes` é obrigatório na querystring, formato `YYYY-MM`; ausente ou mal formatado → 400 com
  `{"mes": "Use o formato YYYY-MM."}` (mesma mensagem já usada em
  `registros_diarios/views.py:55`).
- Reincidência de faltas: `faltas >= 3` no mês (constante nomeada, nunca um número solto).
- Todo valor decimal na resposta da API é string (nunca float) — mesma convenção de
  `decimal_para_str_ou_none` (`projetos/services.py`).
- Convenção de testes já estabelecida: pytest no backend (unit + isolamento multitenant),
  Playwright E2E no frontend — sem Vitest.
- Nunca usar `--no-verify`; commits novos ao invés de amend.

---

### Task 1: `ValorCusto` ganha função/máquina (schema + validação + serializer + seed)

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py:254-283` (classe `ValorCusto`)
- Modify: `backend/buildflow/configuracoes/services.py`
- Modify: `backend/buildflow/configuracoes/serializers.py:67-70` (classe `ValorCustoSerializer`)
- Modify: `backend/buildflow/core/management/commands/seed_demo_data.py`
- Modify: `backend/buildflow/configuracoes/tests/test_api.py`
- Create: `backend/buildflow/configuracoes/migrations/0005_*.py` (gerada por `makemigrations`)

**Interfaces:**
- Produces: `ValorCusto.funcao: str` (blank=True, só relevante quando `tipo=mao_de_obra`),
  `ValorCusto.maquina: Maquina | None` (FK opcional, só relevante quando `tipo=equipamento`).
  `configuracoes.services.validar_valor_custo(*, tipo: str, funcao: str, maquina) -> None`
  (levanta `rest_framework.exceptions.ValidationError`).

- [ ] **Step 1: Escrever o teste que falha (validação de exclusividade via API)**

Adicionar ao final de `backend/buildflow/configuracoes/tests/test_api.py`:

```python
def test_valor_custo_mao_de_obra_com_funcao_e_criado_com_sucesso():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {"tipo": "mao_de_obra", "descricao": "Ajudante", "valor": "250.00", "funcao": "Ajudante"},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["funcao"] == "Ajudante"
    assert response.json()["maquina"] is None


def test_valor_custo_equipamento_com_maquina_e_criado_com_sucesso():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "equipamento",
            "descricao": "Escavadeira 320D",
            "valor": "180.00",
            "maquina": str(maquina.id),
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["maquina"] == str(maquina.id)
    assert response.json()["funcao"] == ""


def test_valor_custo_mao_de_obra_com_maquina_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "mao_de_obra",
            "descricao": "Ajudante",
            "valor": "250.00",
            "maquina": str(maquina.id),
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_valor_custo_equipamento_com_funcao_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/valores/",
        {
            "tipo": "equipamento",
            "descricao": "Escavadeira 320D",
            "valor": "180.00",
            "funcao": "Ajudante",
        },
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
```

Adicionar os imports que faltam no topo do arquivo (junto aos já existentes):

```python
from buildflow.configuracoes.models import Maquina
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && uv run pytest buildflow/configuracoes/tests/test_api.py -k valor_custo -v`
Expected: FAIL — `funcao`/`maquina` não existem no serializer ainda (`KeyError`/campo desconhecido
ou `TypeError` no `.create()`).

- [ ] **Step 3: Adicionar os campos ao model**

Em `backend/buildflow/configuracoes/models.py`, substituir a classe `ValorCusto` inteira (linhas
254-283) por:

```python
class ValorCusto(models.Model):
    """Valor de custo de mao de obra ou equipamento (H — sub-aba "Valores dos
    Contratos"), recorte simplificado sem o modulo completo de
    contratos/medicao (fora do escopo do MVP).

    `valor` e R$/dia quando tipo=mao_de_obra (diaria) e R$/hora quando
    tipo=equipamento (valor-hora de maquina) — usado pelo modulo de Custos &
    Ociosidade para atribuir custo real por funcao/maquina.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="valores_custo",
    )
    tipo = models.CharField(
        _("tipo"),
        max_length=16,
        choices=TipoValorCustoChoices.choices,
    )
    descricao = models.CharField(_("descricao"), max_length=255)
    valor = models.DecimalField(_("valor"), max_digits=12, decimal_places=2)
    funcao = models.CharField(_("função"), max_length=255, blank=True)
    maquina = models.ForeignKey(
        Maquina,
        verbose_name=_("máquina"),
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="valores_custo",
    )

    tenant_path = "projeto__empresa"
    objects = TenantScopedManager()

    class Meta:
        verbose_name = _("valor de custo")
        verbose_name_plural = _("valores de custo")
        ordering = ["descricao"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tipo="mao_de_obra", maquina__isnull=True)
                    | models.Q(tipo="equipamento", funcao="")
                ),
                name="valor_custo_funcao_ou_maquina_por_tipo",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.descricao} ({self.get_tipo_display()})"
```

- [ ] **Step 4: Adicionar a validação de serviço**

Em `backend/buildflow/configuracoes/services.py`, adicionar ao topo do arquivo e ao final:

```python
from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError


def soma_pesos_disciplinas(projeto) -> Decimal:
    """Soma dos pesos percentuais das metas de um projeto.

    Validacao informativa (nao bloqueante): o frontend usa isso so para
    alertar visualmente quando a soma nao fica proxima de 100%, sem impedir
    o salvamento (H: a planilha de metas do prototipo so validava
    visualmente, nunca travava o cadastro).
    """
    total = Decimal("0")
    for meta in projeto.metas.all():
        if meta.peso_percentual is not None:
            total += meta.peso_percentual
    return total


def validar_valor_custo(*, tipo: str, funcao: str, maquina) -> None:
    if tipo == "mao_de_obra" and maquina is not None:
        msg = _("Máquina só pode ser informada quando o tipo é Equipamento.")
        raise ValidationError(msg)
    if tipo == "equipamento" and funcao:
        msg = _("Função só pode ser informada quando o tipo é Mão de obra.")
        raise ValidationError(msg)
```

- [ ] **Step 5: Atualizar o serializer**

Em `backend/buildflow/configuracoes/serializers.py`, substituir a classe `ValorCustoSerializer`
(linhas 67-70) por:

```python
class ValorCustoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValorCusto
        fields = ["id", "tipo", "descricao", "valor", "funcao", "maquina"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        services.validar_valor_custo(
            tipo=attrs.get("tipo"),
            funcao=attrs.get("funcao", ""),
            maquina=attrs.get("maquina"),
        )
        return attrs
```

(Confirmar que `from . import services` já está importado no topo do arquivo — já é o caso, usado
por outros serializers deste mesmo arquivo.)

- [ ] **Step 6: Gerar e aplicar a migration**

Run: `cd backend && uv run python manage.py makemigrations configuracoes`
Expected: cria um arquivo `buildflow/configuracoes/migrations/0005_<nome-gerado>.py` com um
`AddField` para `funcao`, um `AddField` para `maquina` e um `AddConstraint` para
`valor_custo_funcao_ou_maquina_por_tipo`.

Run: `cd backend && uv run python manage.py migrate`
Expected: `Applying configuracoes.0005_...... OK`.

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `cd backend && uv run pytest buildflow/configuracoes/tests/test_api.py -k valor_custo -v`
Expected: PASS nos 4 testes novos.

Run: `cd backend && uv run pytest buildflow/configuracoes/ -v`
Expected: todos os testes do app passando (nenhuma regressão nos testes existentes de
metas/equipes/disciplinas).

- [ ] **Step 8: Estender o seed de demonstração**

Em `backend/buildflow/core/management/commands/seed_demo_data.py`, dentro de
`_seed_configuracao_e_rdo`, fazer 3 mudanças:

1. Capturar as variáveis `pessoa` e `maquina` (hoje descartadas) — trocar:

```python
        equipe = Equipe.objects.create(projeto=projeto, nome="Equipe 1")
        Pessoa.objects.create(equipe=equipe, nome="José Ajudante", funcao="Ajudante")
        Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira 320D")
```

por:

```python
        equipe = Equipe.objects.create(projeto=projeto, nome="Equipe 1")
        pessoa = Pessoa.objects.create(equipe=equipe, nome="José Ajudante", funcao="Ajudante")
        maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira 320D")
```

2. Trocar o `ValorCusto` único existente (era `valor=2500` sem unidade definida — agora que
   `valor` é R$/dia para mão de obra, um número de referência real de mercado é usado) por 2
   entradas, uma por função e uma por máquina:

```python
        ValorCusto.objects.create(
            projeto=projeto,
            tipo="mao_de_obra",
            descricao="Ajudante",
            funcao="Ajudante",
            valor=250,
        )
        ValorCusto.objects.create(
            projeto=projeto,
            tipo="equipamento",
            descricao="Escavadeira 320D",
            maquina=maquina,
            valor=180,
        )
```

3. Adicionar `Presenca` e `ApontamentoMaquina` ao RDO seedado (hoje o RDO só tem `ProducaoDiaria`
   — sem isso o módulo de Custos & Ociosidade ficaria sempre vazio nos dados de demonstração).
   Logo após o `ProducaoDiaria.objects.create(...)` existente, adicionar:

```python
        motivo_chuva, _ = MotivoParada.objects.get_or_create(descricao="Chuva")
        Presenca.objects.create(
            registro_diario=registro,
            pessoa=pessoa,
            funcao="Ajudante",
            status="presente",
            origem="composicao",
        )
        ApontamentoMaquina.objects.create(
            registro_diario=registro,
            maquina=maquina,
            horas_produtivas="7.00",
            horas_paradas="1.00",
            motivo_parada=motivo_chuva,
            origem="composicao",
        )
```

Adicionar os imports que faltam no topo do arquivo:

```python
from buildflow.configuracoes.models import MotivoParada
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
```

- [ ] **Step 9: Rodar o seed manualmente e confirmar que roda sem erro**

Run: `cd backend && uv run python manage.py seed_demo_data`
Expected: `Dados de demonstração criados com sucesso.` (rodar 2x seguidas para confirmar
idempotência — segunda vez não deve criar duplicatas nem falhar).

- [ ] **Step 10: Lint + regressão completa do backend**

Run: `cd backend && uv run ruff check . && uv run ruff format --check .`
Expected: exit 0 nos dois.

Run: `cd backend && uv run pytest`
Expected: suíte completa passando, nenhuma regressão.

- [ ] **Step 11: Commit**

```bash
git add backend/buildflow/configuracoes/models.py backend/buildflow/configuracoes/services.py backend/buildflow/configuracoes/serializers.py backend/buildflow/configuracoes/tests/test_api.py backend/buildflow/configuracoes/migrations/0005_*.py backend/buildflow/core/management/commands/seed_demo_data.py
git commit -m "feat: ValorCusto ganha funcao e maquina para atribuicao real de custo"
```

---

### Task 2: App `custos_ociosidade` (permissão + serviço de cálculo + view + urls)

**Files:**
- Create: `backend/buildflow/custos_ociosidade/__init__.py`
- Create: `backend/buildflow/custos_ociosidade/apps.py`
- Create: `backend/buildflow/custos_ociosidade/services.py`
- Create: `backend/buildflow/custos_ociosidade/views.py`
- Create: `backend/buildflow/custos_ociosidade/urls.py`
- Create: `backend/buildflow/custos_ociosidade/tests/__init__.py`
- Create: `backend/buildflow/custos_ociosidade/tests/test_services.py`
- Create: `backend/buildflow/custos_ociosidade/tests/test_api.py`
- Modify: `backend/buildflow/core/permissions.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`

**Interfaces:**
- Consumes: `ValorCusto.funcao`/`ValorCusto.maquina` (Task 1); `decimal_para_str_ou_none` de
  `buildflow.projetos.services`; `Presenca`, `ApontamentoMaquina`, `StatusPresencaChoices` de
  `buildflow.registros_diarios.models`.
- Produces: `custos_ociosidade.services.calcular_custos_ociosidade(projeto, ano: int, mes: int) -> dict`
  (formato de resposta exato descrito no spec); `core.permissions.IsGerente` (classe de permissão
  DRF); endpoint `GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM`.

- [ ] **Step 1: Criar o app e registrá-lo**

Run: `ls backend/buildflow` para confirmar a estrutura antes de criar.

Criar `backend/buildflow/custos_ociosidade/__init__.py` (vazio).

Criar `backend/buildflow/custos_ociosidade/apps.py`:

```python
from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CustosOciosidadeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "buildflow.custos_ociosidade"
    verbose_name = _("Custos e ociosidade")
```

Criar `backend/buildflow/custos_ociosidade/tests/__init__.py` (vazio).

Em `backend/config/settings/base.py`, na lista `LOCAL_APPS`, trocar:

```python
LOCAL_APPS = [
    "buildflow.empresas",
    "buildflow.usuarios",
    "buildflow.core",
    "buildflow.projetos",
    "buildflow.configuracoes",
    "buildflow.registros_diarios",
    # Your stuff: custom apps go here
]
```

por:

```python
LOCAL_APPS = [
    "buildflow.empresas",
    "buildflow.usuarios",
    "buildflow.core",
    "buildflow.projetos",
    "buildflow.configuracoes",
    "buildflow.registros_diarios",
    "buildflow.custos_ociosidade",
    # Your stuff: custom apps go here
]
```

- [ ] **Step 2: Adicionar a permissão `IsGerente`**

Em `backend/buildflow/core/permissions.py`, adicionar o import no topo do arquivo (`usuarios.models`
não importa nada de `core`, então não há risco de import circular):

```python
from buildflow.usuarios.models import PerfilChoices
```

E adicionar ao final do arquivo:

```python
class IsGerente(BasePermission):
    """Restringe a view ao perfil Gerente.

    Primeira restricao real por perfil do sistema — dados de custo/deficit
    por pessoa sao sensiveis o bastante para nao serem visiveis ao perfil
    Auxiliar administrativo (mesma regra ja aplicada no protótipo funcional
    de referencia do sistema).
    """

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        return bool(
            user and user.is_authenticated and user.perfil == PerfilChoices.GERENTE,
        )
```

- [ ] **Step 3: Escrever o teste de cálculo que falha**

Criar `backend/buildflow/custos_ociosidade/tests/test_services.py`:

```python
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import Maquina
from buildflow.configuracoes.models import MotivoParada
from buildflow.configuracoes.models import ValorCusto
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.custos_ociosidade.services import calcular_custos_ociosidade
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.tests.factories import EquipeFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory

pytestmark = pytest.mark.django_db

ANO = 2026
MES = 7


def _criar_rdo(projeto, equipe, autor, dia):
    return RegistroDiario.objects.create(
        projeto=projeto,
        data_referencia=f"{ANO}-{MES:02d}-{dia:02d}",
        turno="diurno",
        clima="sol",
        equipe=equipe,
        fiscal=autor,
        autor=autor,
    )


def test_custo_e_deficit_de_mao_de_obra_com_valor_cadastrado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="mao_de_obra",
        descricao="Ajudante",
        funcao="Ajudante",
        valor=Decimal("250.00"),
    )

    rdo1 = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo1,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="presente",
        origem="avulso",
    )
    rdo2 = _criar_rdo(projeto, equipe, usuario, dia=2)
    Presenca.objects.create(
        registro_diario=rdo2,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="falta",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["custo_mao_de_obra"] == "250.00"
    assert resultado["deficit_mao_de_obra"] == "250.00"
    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["funcao"] == "Ajudante"
    assert funcao["dias_trabalhados"] == 1
    assert funcao["faltas"] == 1
    assert funcao["tem_valor_cadastrado"] is True


def test_atestado_nao_gera_deficit():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="mao_de_obra",
        descricao="Ajudante",
        funcao="Ajudante",
        valor=Decimal("250.00"),
    )
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador 1",
        funcao="Ajudante",
        status="atestado",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["deficit_mao_de_obra"] == "0.00"
    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["atestados"] == 1
    assert funcao["faltas"] == 0


def test_funcao_sem_valor_cadastrado_entra_na_contagem_mas_custo_zero():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador 1",
        funcao="Motorista",
        status="presente",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    funcao = resultado["mao_de_obra_por_funcao"][0]
    assert funcao["tem_valor_cadastrado"] is False
    assert funcao["custo"] == "0"


def test_custo_e_ocioso_de_maquina_com_valor_cadastrado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    maquina = Maquina.objects.create(equipe=equipe, codigo="ESC-01", nome="Escavadeira")
    ValorCusto.objects.create(
        projeto=projeto,
        tipo="equipamento",
        descricao="Escavadeira",
        maquina=maquina,
        valor=Decimal("100.00"),
    )
    motivo = MotivoParada.objects.create(descricao="Chuva")
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    ApontamentoMaquina.objects.create(
        registro_diario=rdo,
        maquina=maquina,
        horas_produtivas="6.00",
        horas_paradas="2.00",
        motivo_parada=motivo,
        origem="composicao",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["custo_produtivo_maquinas"] == "600.00"
    assert resultado["custo_ocioso_maquinas"] == "200.00"
    assert resultado["horas_ociosas_total"] == "2.00"
    item = resultado["maquinas_por_equipamento"][0]
    assert item["eficiencia_percentual"] == 75
    assert resultado["horas_ociosas_por_causa"] == [{"motivo": "Chuva", "horas": "2.00"}]


def test_eficiencia_gerencial_e_none_sem_nenhuma_hora_registrada():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["eficiencia_gerencial_percentual"] is None
    assert resultado["mao_de_obra_por_funcao"] == []
    assert resultado["maquinas_por_equipamento"] == []


def test_reincidencia_de_faltas_por_pessoa():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    from buildflow.configuracoes.models import Pessoa

    pessoa = Pessoa.objects.create(equipe=equipe, nome="João", funcao="Ajudante")
    for dia in (1, 2, 3):
        rdo = _criar_rdo(projeto, equipe, usuario, dia=dia)
        Presenca.objects.create(
            registro_diario=rdo,
            pessoa=pessoa,
            funcao="Ajudante",
            status="falta",
            origem="composicao",
        )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    falta = resultado["faltas_por_pessoa"][0]
    assert falta["faltas"] == 3
    assert falta["reincidente"] is True


def test_pessoa_avulsa_nunca_aparece_em_faltas_por_pessoa():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    equipe = EquipeFactory(projeto=projeto)
    rdo = _criar_rdo(projeto, equipe, usuario, dia=1)
    Presenca.objects.create(
        registro_diario=rdo,
        nome_avulso="Trabalhador Avulso",
        funcao="Ajudante",
        status="falta",
        origem="avulso",
    )

    resultado = calcular_custos_ociosidade(projeto, ANO, MES)

    assert resultado["faltas_por_pessoa"] == []
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `cd backend && uv run pytest buildflow/custos_ociosidade/ -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'buildflow.custos_ociosidade.services'`.

- [ ] **Step 5: Implementar o serviço de cálculo**

Criar `backend/buildflow/custos_ociosidade/services.py`:

```python
from __future__ import annotations

from decimal import Decimal

from buildflow.configuracoes.models import ValorCusto
from buildflow.projetos.models import Projeto
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
from buildflow.registros_diarios.models import StatusPresencaChoices

FALTAS_REINCIDENCIA_MINIMA = 3


def _buscar_presencas_do_mes(projeto: Projeto, ano: int, mes: int):
    return Presenca.objects.filter(
        registro_diario__projeto=projeto,
        registro_diario__data_referencia__year=ano,
        registro_diario__data_referencia__month=mes,
    ).select_related("pessoa")


def _buscar_apontamentos_do_mes(projeto: Projeto, ano: int, mes: int):
    return ApontamentoMaquina.objects.filter(
        registro_diario__projeto=projeto,
        registro_diario__data_referencia__year=ano,
        registro_diario__data_referencia__month=mes,
    ).select_related("maquina", "maquina__equipe", "motivo_parada")


def _diaria_por_funcao(projeto: Projeto) -> dict[str, Decimal]:
    valores = ValorCusto.objects.filter(projeto=projeto, tipo="mao_de_obra").exclude(funcao="")
    return {v.funcao.strip().lower(): v.valor for v in valores}


def _valor_hora_por_maquina(projeto: Projeto) -> dict[str, Decimal]:
    valores = ValorCusto.objects.filter(
        projeto=projeto,
        tipo="equipamento",
        maquina__isnull=False,
    )
    return {str(v.maquina_id): v.valor for v in valores}


def _agrupar_mao_de_obra_por_funcao(presencas) -> dict[str, dict]:
    agrupado: dict[str, dict] = {}
    for presenca in presencas:
        chave = presenca.funcao.strip().lower()
        registro = agrupado.setdefault(
            chave,
            {"funcao": presenca.funcao, "dias_trabalhados": 0, "faltas": 0, "atestados": 0},
        )
        if presenca.status == StatusPresencaChoices.PRESENTE:
            registro["dias_trabalhados"] += 1
        elif presenca.status == StatusPresencaChoices.FALTA:
            registro["faltas"] += 1
        elif presenca.status == StatusPresencaChoices.ATESTADO:
            registro["atestados"] += 1
    return agrupado


def _montar_payload_mao_de_obra(agrupado: dict[str, dict], diarias: dict[str, Decimal]):
    custo_total = Decimal("0")
    deficit_total = Decimal("0")
    payload = []
    for chave, dados in sorted(agrupado.items()):
        diaria = diarias.get(chave)
        custo = dados["dias_trabalhados"] * diaria if diaria is not None else Decimal("0")
        deficit = dados["faltas"] * diaria if diaria is not None else Decimal("0")
        custo_total += custo
        deficit_total += deficit
        payload.append(
            {
                "funcao": dados["funcao"],
                "dias_trabalhados": dados["dias_trabalhados"],
                "faltas": dados["faltas"],
                "atestados": dados["atestados"],
                "custo": decimal_para_str_ou_none(custo),
                "deficit": decimal_para_str_ou_none(deficit),
                "tem_valor_cadastrado": diaria is not None,
            },
        )
    return custo_total, deficit_total, payload


def _agrupar_maquinas(apontamentos):
    agrupado: dict[str, dict] = {}
    horas_por_causa: dict[str, Decimal] = {}
    horas_produtivas_total = Decimal("0")
    horas_paradas_total = Decimal("0")

    for apontamento in apontamentos:
        horas_produtivas_total += apontamento.horas_produtivas
        horas_paradas_total += apontamento.horas_paradas

        if apontamento.horas_paradas > 0 and apontamento.motivo_parada:
            causa = apontamento.motivo_parada.descricao
            horas_por_causa[causa] = (
                horas_por_causa.get(causa, Decimal("0")) + apontamento.horas_paradas
            )

        if not apontamento.maquina_id:
            continue
        maquina = apontamento.maquina
        registro = agrupado.setdefault(
            str(maquina.id),
            {
                "maquina_id": str(maquina.id),
                "codigo": maquina.codigo,
                "nome": maquina.nome,
                "equipe_nome": maquina.equipe.nome,
                "horas_produtivas": Decimal("0"),
                "horas_paradas": Decimal("0"),
            },
        )
        registro["horas_produtivas"] += apontamento.horas_produtivas
        registro["horas_paradas"] += apontamento.horas_paradas

    return agrupado, horas_por_causa, horas_produtivas_total, horas_paradas_total


def _calcular_eficiencia_percentual(
    horas_produtivas: Decimal,
    horas_paradas: Decimal,
) -> int | None:
    total = horas_produtivas + horas_paradas
    if total == 0:
        return None
    return round(float(horas_produtivas / total * 100))


def _montar_payload_maquinas(agrupado: dict[str, dict], valores_hora: dict[str, Decimal]):
    custo_produtivo_total = Decimal("0")
    custo_ocioso_total = Decimal("0")
    payload = []
    for maquina_id, dados in sorted(agrupado.items(), key=lambda item: item[1]["codigo"]):
        valor_hora = valores_hora.get(maquina_id)
        custo_produtivo = (
            dados["horas_produtivas"] * valor_hora if valor_hora is not None else Decimal("0")
        )
        custo_ocioso = (
            dados["horas_paradas"] * valor_hora if valor_hora is not None else Decimal("0")
        )
        custo_produtivo_total += custo_produtivo
        custo_ocioso_total += custo_ocioso
        payload.append(
            {
                "maquina_id": dados["maquina_id"],
                "codigo": dados["codigo"],
                "nome": dados["nome"],
                "equipe_nome": dados["equipe_nome"],
                "horas_produtivas": decimal_para_str_ou_none(dados["horas_produtivas"]),
                "horas_paradas": decimal_para_str_ou_none(dados["horas_paradas"]),
                "custo_produtivo": decimal_para_str_ou_none(custo_produtivo),
                "custo_ocioso": decimal_para_str_ou_none(custo_ocioso),
                "eficiencia_percentual": _calcular_eficiencia_percentual(
                    dados["horas_produtivas"],
                    dados["horas_paradas"],
                ),
                "tem_valor_cadastrado": valor_hora is not None,
            },
        )
    return custo_produtivo_total, custo_ocioso_total, payload


def _montar_payload_faltas_por_pessoa(presencas, diarias: dict[str, Decimal]):
    agrupado: dict[str, dict] = {}
    for presenca in presencas:
        if not presenca.pessoa_id:
            continue
        registro = agrupado.setdefault(
            str(presenca.pessoa_id),
            {
                "pessoa_id": str(presenca.pessoa_id),
                "nome": presenca.pessoa.nome,
                "funcao": presenca.funcao,
                "faltas": 0,
                "atestados": 0,
            },
        )
        if presenca.status == StatusPresencaChoices.FALTA:
            registro["faltas"] += 1
        elif presenca.status == StatusPresencaChoices.ATESTADO:
            registro["atestados"] += 1

    payload = []
    for dados in agrupado.values():
        if dados["faltas"] == 0:
            continue
        diaria = diarias.get(dados["funcao"].strip().lower())
        valor_perdido = dados["faltas"] * diaria if diaria is not None else Decimal("0")
        payload.append(
            {
                "pessoa_id": dados["pessoa_id"],
                "nome": dados["nome"],
                "funcao": dados["funcao"],
                "faltas": dados["faltas"],
                "atestados": dados["atestados"],
                "valor_perdido": decimal_para_str_ou_none(valor_perdido),
                "reincidente": dados["faltas"] >= FALTAS_REINCIDENCIA_MINIMA,
            },
        )
    payload.sort(key=lambda item: item["faltas"], reverse=True)
    return payload


def _montar_horas_por_causa_payload(horas_por_causa: dict[str, Decimal]):
    return [
        {"motivo": motivo, "horas": decimal_para_str_ou_none(horas)}
        for motivo, horas in sorted(
            horas_por_causa.items(),
            key=lambda item: item[1],
            reverse=True,
        )
    ]


def calcular_custos_ociosidade(projeto: Projeto, ano: int, mes: int) -> dict:
    presencas = list(_buscar_presencas_do_mes(projeto, ano, mes))
    apontamentos = _buscar_apontamentos_do_mes(projeto, ano, mes)

    diarias = _diaria_por_funcao(projeto)
    valores_hora = _valor_hora_por_maquina(projeto)

    agrupado_mao_de_obra = _agrupar_mao_de_obra_por_funcao(presencas)
    custo_mao_de_obra, deficit_mao_de_obra, mao_de_obra_payload = _montar_payload_mao_de_obra(
        agrupado_mao_de_obra,
        diarias,
    )

    (
        agrupado_maquinas,
        horas_por_causa,
        horas_produtivas_total,
        horas_paradas_total,
    ) = _agrupar_maquinas(apontamentos)
    custo_produtivo_maquinas, custo_ocioso_maquinas, maquinas_payload = _montar_payload_maquinas(
        agrupado_maquinas,
        valores_hora,
    )

    return {
        "mes": f"{ano:04d}-{mes:02d}",
        "custo_mao_de_obra": decimal_para_str_ou_none(custo_mao_de_obra),
        "deficit_mao_de_obra": decimal_para_str_ou_none(deficit_mao_de_obra),
        "custo_produtivo_maquinas": decimal_para_str_ou_none(custo_produtivo_maquinas),
        "custo_ocioso_maquinas": decimal_para_str_ou_none(custo_ocioso_maquinas),
        "custo_total": decimal_para_str_ou_none(custo_mao_de_obra + custo_produtivo_maquinas),
        "ociosidade_evitavel_total": decimal_para_str_ou_none(
            custo_ocioso_maquinas + deficit_mao_de_obra,
        ),
        "horas_ociosas_total": decimal_para_str_ou_none(horas_paradas_total),
        "eficiencia_gerencial_percentual": _calcular_eficiencia_percentual(
            horas_produtivas_total,
            horas_paradas_total,
        ),
        "mao_de_obra_por_funcao": mao_de_obra_payload,
        "maquinas_por_equipamento": maquinas_payload,
        "horas_ociosas_por_causa": _montar_horas_por_causa_payload(horas_por_causa),
        "faltas_por_pessoa": _montar_payload_faltas_por_pessoa(presencas, diarias),
    }
```

- [ ] **Step 6: Rodar os testes de serviço e confirmar que passam**

Run: `cd backend && uv run pytest buildflow/custos_ociosidade/tests/test_services.py -v`
Expected: PASS nos 7 testes.

- [ ] **Step 7: Escrever o teste de API que falha**

Criar `backend/buildflow/custos_ociosidade/tests/test_api.py`:

```python
from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from buildflow.core.tests.factories import UsuarioFactory
from buildflow.registros_diarios.tests.factories import ProjetoParaRdoFactory
from buildflow.usuarios.models import PerfilChoices

pytestmark = pytest.mark.django_db


def _authenticated_client(usuario) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_gerente_acessa_custos_ociosidade_do_proprio_projeto():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json()["mes"] == "2026-07"


def test_auxiliar_administrativo_recebe_403():
    usuario = UsuarioFactory(perfil=PerfilChoices.AUXILIAR_ADMINISTRATIVO)
    projeto = ProjetoParaRdoFactory(criado_por=UsuarioFactory(empresa=usuario.empresa))

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_projeto_de_outra_empresa_retorna_404():
    usuario_a = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto_a = ProjetoParaRdoFactory(criado_por=usuario_a)
    usuario_b = UsuarioFactory(perfil=PerfilChoices.GERENTE)

    response = _authenticated_client(usuario_b).get(
        f"/api/v1/projetos/{projeto_a.id}/custos-ociosidade/?mes=2026-07",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_mes_ausente_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_mes_mal_formatado_retorna_400():
    usuario = UsuarioFactory(perfil=PerfilChoices.GERENTE)
    projeto = ProjetoParaRdoFactory(criado_por=usuario)

    response = _authenticated_client(usuario).get(
        f"/api/v1/projetos/{projeto.id}/custos-ociosidade/?mes=julho-2026",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
```

- [ ] **Step 8: Rodar e confirmar que falha**

Run: `cd backend && uv run pytest buildflow/custos_ociosidade/tests/test_api.py -v`
Expected: FAIL — rota `/api/v1/projetos/{id}/custos-ociosidade/` não existe ainda (404 em todos).

- [ ] **Step 9: Implementar a view e a rota**

Criar `backend/buildflow/custos_ociosidade/views.py`:

```python
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from buildflow.core.permissions import IsAuthenticatedWithEmpresa
from buildflow.core.permissions import IsGerente
from buildflow.projetos.models import Projeto

from .services import calcular_custos_ociosidade


class CustosOciosidadeView(APIView):
    """Custo/deficit de mao de obra e custo/ociosidade de maquinas de um
    projeto, por mes — somente leitura, restrito ao perfil Gerente."""

    permission_classes = (IsAuthenticatedWithEmpresa, IsGerente)

    def get(self, request, projeto_pk):
        projeto = get_object_or_404(
            Projeto.objects.for_empresa(request.user.empresa),
            pk=projeto_pk,
        )

        ano, mes = self._parse_filtro_mes(request.query_params.get("mes"))

        return Response(calcular_custos_ociosidade(projeto, ano, mes))

    @staticmethod
    def _parse_filtro_mes(mes: str | None) -> tuple[int, int]:
        if not mes:
            raise ValidationError({"mes": "Use o formato YYYY-MM."})
        try:
            ano_str, mes_str = mes.split("-")
            return int(ano_str), int(mes_str)
        except ValueError as erro:
            raise ValidationError({"mes": "Use o formato YYYY-MM."}) from erro
```

Criar `backend/buildflow/custos_ociosidade/urls.py`:

```python
from django.urls import path

from .views import CustosOciosidadeView

app_name = "custos_ociosidade"

urlpatterns = [
    path(
        "projetos/<uuid:projeto_pk>/custos-ociosidade/",
        CustosOciosidadeView.as_view(),
        name="custos-ociosidade",
    ),
]
```

Em `backend/config/urls.py`, trocar:

```python
    path("api/v1/", include("config.api_router")),
    # Rotas aninhadas (registros diarios sob projeto) - fora do router flat
    path("api/v1/", include("buildflow.registros_diarios.urls")),
    path("api/v1/", include("buildflow.configuracoes.urls")),
```

por:

```python
    path("api/v1/", include("config.api_router")),
    # Rotas aninhadas (registros diarios sob projeto) - fora do router flat
    path("api/v1/", include("buildflow.registros_diarios.urls")),
    path("api/v1/", include("buildflow.configuracoes.urls")),
    path("api/v1/", include("buildflow.custos_ociosidade.urls")),
```

- [ ] **Step 10: Rodar os testes de API e confirmar que passam**

Run: `cd backend && uv run pytest buildflow/custos_ociosidade/ -v`
Expected: PASS em todos (7 de serviço + 5 de API).

- [ ] **Step 11: Lint + regressão completa do backend**

Run: `cd backend && uv run ruff check . && uv run ruff format --check .`
Expected: exit 0 nos dois.

Run: `cd backend && uv run pytest`
Expected: suíte completa passando.

- [ ] **Step 12: Commit**

```bash
git add backend/buildflow/custos_ociosidade backend/buildflow/core/permissions.py backend/config/settings/base.py backend/config/urls.py
git commit -m "feat: adiciona modulo Custos & Ociosidade (backend)"
```

---

### Task 3: Frontend — Configurações → Valores ganha função/máquina

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts`
- Modify: `frontend/src/pages/ConfiguracaoPage.tsx`
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: `ValorCusto.funcao`/`ValorCusto.maquina` do backend (Task 1, sempre presentes na
  resposta: `funcao: string` vazia quando não aplicável, `maquina: string | null`).
- Produces: `ValorCusto` (tipo TS) com `funcao`/`maquina`; `useCriarValorCusto` aceitando
  `funcao?`/`maquina?` opcionais no payload.

- [ ] **Step 1: Atualizar o tipo `ValorCusto`**

Em `frontend/src/types/configuracao.ts`, trocar:

```ts
export interface ValorCusto {
  id: string
  tipo: 'mao_de_obra' | 'equipamento'
  descricao: string
  valor: string
}
```

por:

```ts
export interface ValorCusto {
  id: string
  tipo: 'mao_de_obra' | 'equipamento'
  descricao: string
  valor: string
  funcao: string
  maquina: string | null
}
```

- [ ] **Step 2: Atualizar `useCriarValorCusto`**

Em `frontend/src/features/configuracoes/configuracaoApi.ts`, trocar:

```ts
export function useCriarValorCusto(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: { tipo: string; descricao: string; valor: string }) =>
      apiClient.post<ValorCusto>(`/api/v1/projetos/${projetoId}/configuracao/valores/`, values),
    onSuccess: invalidar,
  })
}
```

por:

```ts
export function useCriarValorCusto(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: {
      tipo: string
      descricao: string
      valor: string
      funcao?: string
      maquina?: string
    }) => apiClient.post<ValorCusto>(`/api/v1/projetos/${projetoId}/configuracao/valores/`, values),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 3: Build para confirmar que o tipo compila (ainda sem uso na página)**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: exit 0.

- [ ] **Step 4: Atualizar `ConfiguracaoPage.tsx` — estado novo**

Adicionar, junto aos outros `useState` de "valor" (próximo à linha
`const [valorValor, setValorValor] = useState('')`):

```tsx
  const [valorFuncao, setValorFuncao] = useState('')
  const [valorMaquinaId, setValorMaquinaId] = useState('')
```

- [ ] **Step 5: Atualizar `ConfiguracaoPage.tsx` — formulário da aba Valores**

Substituir o bloco `<TabsContent value="valores">...</TabsContent>` inteiro (linhas 271-315 do
arquivo atual) por:

```tsx
        <TabsContent value="valores">
          <Card title="Valores">
            <div aria-label="Valores de custo">
              {valoresCusto.length === 0 && <EmptyState>Nenhum valor cadastrado ainda.</EmptyState>}
              <ul className="mb-4 divide-y divide-border">
                {valoresCusto.map((valor) => (
                  <li className="py-2 text-sm" key={valor.id}>
                    {valor.descricao} ({valor.tipo === 'mao_de_obra' ? 'Mão de obra' : 'Equipamento'})
                    {valor.funcao && ` — ${valor.funcao}`}: {valor.valor}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <SelectField
                  id="valor-tipo"
                  label="Tipo"
                  value={valorTipo}
                  onChange={(value) => setValorTipo(value as typeof valorTipo)}
                  options={[
                    { value: 'mao_de_obra', label: 'Mão de obra' },
                    { value: 'equipamento', label: 'Equipamento' },
                  ]}
                />
                {valorTipo === 'mao_de_obra' ? (
                  <FormField id="valor-funcao" label="Função">
                    <Input
                      id="valor-funcao"
                      value={valorFuncao}
                      onChange={(event) => setValorFuncao(event.target.value)}
                    />
                  </FormField>
                ) : (
                  <SelectField
                    id="valor-maquina"
                    label="Máquina"
                    value={valorMaquinaId}
                    onChange={setValorMaquinaId}
                    options={equipes.flatMap((equipe) =>
                      equipe.maquinas.map((maquina) => ({
                        value: maquina.id,
                        label: `${maquina.nome} (${maquina.codigo})`,
                      })),
                    )}
                  />
                )}
                <FormField id="valor-descricao" label="Descrição">
                  <Input
                    id="valor-descricao"
                    value={valorDescricao}
                    onChange={(event) => setValorDescricao(event.target.value)}
                  />
                </FormField>
                <FormField
                  id="valor-valor"
                  label={valorTipo === 'mao_de_obra' ? 'Valor (R$/dia)' : 'Valor (R$/hora)'}
                >
                  <Input id="valor-valor" value={valorValor} onChange={(event) => setValorValor(event.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!valorDescricao.trim() || !valorValor || criarValorCusto.isPending}
                    onClick={() =>
                      criarValorCusto.mutate(
                        {
                          tipo: valorTipo,
                          descricao: valorDescricao,
                          valor: valorValor,
                          funcao: valorTipo === 'mao_de_obra' ? valorFuncao : undefined,
                          maquina: valorTipo === 'equipamento' ? valorMaquinaId : undefined,
                        },
                        {
                          onSuccess: () => {
                            setValorDescricao('')
                            setValorValor('')
                            setValorFuncao('')
                            setValorMaquinaId('')
                          },
                        },
                      )
                    }
                  >
                    Adicionar valor
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
```

- [ ] **Step 6: Build e regressão E2E completa**

Run: `cd frontend && npm run build`
Expected: exit 0.

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: os 2 testes existentes continuam passando (o rótulo "Valor" mudou para "Valor (R$/dia)"
quando tipo é mão de obra — nenhum teste existente depende do texto exato desse rótulo, só do
`id`/`for` via `getByLabel`, então isso não quebra).

- [ ] **Step 7: Adicionar teste E2E para o campo condicional de máquina**

Adicionar a `frontend/tests/e2e/config.spec.ts`, ao final do arquivo:

```typescript
test('tipo equipamento mostra seletor de máquina cadastrada em vez de função', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [],
        equipes: [
          {
            id: 'equipe-1',
            nome: 'Equipe A',
            pessoas: [],
            maquinas: [{ id: 'maquina-1', codigo: 'ESC-01', nome: 'Escavadeira 320D' }],
          },
        ],
        metas: [],
        valores_custo: [],
        soma_pesos_metas: 0,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'Valores' }).click()

  await expect(page.getByLabel('Função')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/dia)')).toBeVisible()

  // "Tipo" e "Máquina" sao SelectField (Radix, nao <select> nativo) — abrir
  // via click e escolher a opcao por role, nao .selectOption() (nativo).
  await page.getByLabel('Tipo').click()
  await page.getByRole('option', { name: 'Equipamento' }).click()

  await expect(page.getByLabel('Função')).not.toBeVisible()
  await expect(page.getByLabel('Máquina')).toBeVisible()
  await expect(page.getByLabel('Valor (R$/hora)')).toBeVisible()

  await page.getByLabel('Máquina').click()
  await expect(page.getByRole('option', { name: 'Escavadeira 320D (ESC-01)' })).toBeVisible()
})
```

- [ ] **Step 8: Rodar o teste novo e a suíte completa**

Run: `cd frontend && npx playwright test tests/e2e/config.spec.ts`
Expected: 3/3 passando (2 existentes + 1 novo).

Run: `cd frontend && npx playwright test`
Expected: suíte completa passando.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/configuracao.ts frontend/src/features/configuracoes/configuracaoApi.ts frontend/src/pages/ConfiguracaoPage.tsx frontend/tests/e2e/config.spec.ts
git commit -m "feat: adiciona funcao e maquina ao formulario de Valores em Configuracoes"
```

---

### Task 4: Frontend — página Custos & Ociosidade

**Files:**
- Create: `frontend/src/types/custoOciosidade.ts`
- Create: `frontend/src/features/custos-ociosidade/custosOciosidadeApi.ts`
- Create: `frontend/src/pages/CustosOciosidadePage.tsx`
- Modify: `frontend/src/lib/format.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/layouts/Sidebar.tsx`
- Create: `frontend/tests/e2e/custos-ociosidade.spec.ts`

**Interfaces:**
- Consumes: `GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM` (Task 2, formato de
  resposta exato do spec); `useAuth().user.perfil` (`frontend/src/types/auth.ts`, já existe).
- Produces: `useCustosOciosidade(projetoId: string, mes: string, habilitado: boolean)`;
  `formatMoeda(valor: string): string`; rota `/projetos/:projetoId/custos-ociosidade`.

- [ ] **Step 1: Criar os tipos de resposta**

Criar `frontend/src/types/custoOciosidade.ts`:

```ts
export interface MaoDeObraPorFuncao {
  funcao: string
  dias_trabalhados: number
  faltas: number
  atestados: number
  custo: string
  deficit: string
  tem_valor_cadastrado: boolean
}

export interface MaquinaPorEquipamento {
  maquina_id: string
  codigo: string
  nome: string
  equipe_nome: string
  horas_produtivas: string
  horas_paradas: string
  custo_produtivo: string
  custo_ocioso: string
  eficiencia_percentual: number | null
  tem_valor_cadastrado: boolean
}

export interface HorasOciosasPorCausa {
  motivo: string
  horas: string
}

export interface FaltaPorPessoa {
  pessoa_id: string
  nome: string
  funcao: string
  faltas: number
  atestados: number
  valor_perdido: string
  reincidente: boolean
}

export interface CustosOciosidade {
  mes: string
  custo_mao_de_obra: string
  deficit_mao_de_obra: string
  custo_produtivo_maquinas: string
  custo_ocioso_maquinas: string
  custo_total: string
  ociosidade_evitavel_total: string
  horas_ociosas_total: string
  eficiencia_gerencial_percentual: number | null
  mao_de_obra_por_funcao: MaoDeObraPorFuncao[]
  maquinas_por_equipamento: MaquinaPorEquipamento[]
  horas_ociosas_por_causa: HorasOciosasPorCausa[]
  faltas_por_pessoa: FaltaPorPessoa[]
}
```

- [ ] **Step 2: Criar o hook de dados**

Criar `frontend/src/features/custos-ociosidade/custosOciosidadeApi.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/apiClient'
import type { CustosOciosidade } from '../../types/custoOciosidade'

export function useCustosOciosidade(projetoId: string, mes: string, habilitado: boolean) {
  return useQuery({
    queryKey: ['custos-ociosidade', projetoId, mes],
    queryFn: () =>
      apiClient.get<CustosOciosidade>(
        `/api/v1/projetos/${projetoId}/custos-ociosidade/?mes=${mes}`,
      ),
    enabled: habilitado && Boolean(projetoId) && Boolean(mes),
  })
}
```

(`habilitado` evita disparar uma requisição fadada a 403 quando o usuário não é Gerente — a
página nunca chama a API nesse caso, só mostra a mensagem de acesso restrito.)

- [ ] **Step 3: Adicionar o formatador de moeda**

Em `frontend/src/lib/format.ts`, adicionar ao final do arquivo:

```ts
const FORMATADOR_MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoeda(valor: string): string {
  return FORMATADOR_MOEDA.format(Number(valor))
}
```

- [ ] **Step 4: Criar a página**

Criar `frontend/src/pages/CustosOciosidadePage.tsx`:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Card, EmptyState, ErrorRetry, PageHeader, Skeleton } from '../components/ui'
import { useAuth } from '../features/auth/AuthContext'
import { useCustosOciosidade } from '../features/custos-ociosidade/custosOciosidadeApi'
import { formatMoeda } from '../lib/format'
import type { CustosOciosidade } from '../types/custoOciosidade'

function mesAtualFiltro(): string {
  return new Date().toISOString().slice(0, 7)
}

function CustosOciosidadeSkeleton() {
  return (
    <>
      <span role="status" className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    </>
  )
}

function TileCusto({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-xl font-bold text-ink">{valor}</p>
    </div>
  )
}

function BarraHistograma({
  label,
  principal,
  secundario,
  maximo,
}: {
  label: string
  principal: number
  secundario: number
  maximo: number
}) {
  const pctPrincipal = maximo > 0 ? (principal / maximo) * 100 : 0
  const pctSecundario = maximo > 0 ? (secundario / maximo) * 100 : 0
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-emerald-500" style={{ width: `${pctPrincipal}%` }} />
        <div className="h-full bg-red-500" style={{ width: `${pctSecundario}%` }} />
      </div>
    </div>
  )
}

function SemValorDefinido() {
  return (
    <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      sem valor definido
    </span>
  )
}

function CustosOciosidadeConteudo({ dados }: { dados: CustosOciosidade }) {
  const maximoMaoDeObra = Math.max(
    ...dados.mao_de_obra_por_funcao.map((item) => Number(item.custo) + Number(item.deficit)),
    1,
  )
  const maximoMaquinas = Math.max(
    ...dados.maquinas_por_equipamento.map(
      (item) => Number(item.custo_produtivo) + Number(item.custo_ocioso),
    ),
    1,
  )

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <TileCusto label="Custo mão de obra" valor={formatMoeda(dados.custo_mao_de_obra)} />
        <TileCusto label="Déficit mão de obra" valor={formatMoeda(dados.deficit_mao_de_obra)} />
        <TileCusto label="Custo máquinas" valor={formatMoeda(dados.custo_produtivo_maquinas)} />
        <TileCusto label="Custo ocioso máquinas" valor={formatMoeda(dados.custo_ocioso_maquinas)} />
        <TileCusto label="Custo total do mês" valor={formatMoeda(dados.custo_total)} />
        <TileCusto label="Ociosidade evitável" valor={formatMoeda(dados.ociosidade_evitavel_total)} />
        <TileCusto label="Horas ociosas" valor={`${dados.horas_ociosas_total}h`} />
        <TileCusto
          label="Eficiência gerencial"
          valor={
            dados.eficiencia_gerencial_percentual === null
              ? '—'
              : `${dados.eficiencia_gerencial_percentual}%`
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Mão de obra por função" eyebrow="Custo trabalhado vs. déficit">
          {dados.mao_de_obra_por_funcao.length === 0 ? (
            <EmptyState>Nenhuma presença registrada no mês.</EmptyState>
          ) : (
            dados.mao_de_obra_por_funcao.map((item) => (
              <BarraHistograma
                key={item.funcao}
                label={item.funcao}
                principal={Number(item.custo)}
                secundario={Number(item.deficit)}
                maximo={maximoMaoDeObra}
              />
            ))
          )}
        </Card>

        <Card title="Máquinas por equipamento" eyebrow="Custo produtivo vs. ocioso">
          {dados.maquinas_por_equipamento.length === 0 ? (
            <EmptyState>Nenhum apontamento de máquina no mês.</EmptyState>
          ) : (
            dados.maquinas_por_equipamento.map((item) => (
              <BarraHistograma
                key={item.maquina_id}
                label={`${item.nome} (${item.codigo})`}
                principal={Number(item.custo_produtivo)}
                secundario={Number(item.custo_ocioso)}
                maximo={maximoMaquinas}
              />
            ))
          )}
        </Card>
      </div>

      <Card title="Eficiência e custo parado por equipamento">
        {dados.maquinas_por_equipamento.length === 0 ? (
          <EmptyState>Nenhum apontamento de máquina no mês.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {dados.maquinas_por_equipamento.map((item) => (
              <li key={item.maquina_id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {item.nome} ({item.codigo}) — {item.equipe_nome}
                </span>
                <span className="flex items-center">
                  {item.eficiencia_percentual === null ? '—' : `${item.eficiencia_percentual}%`}
                  {' · '}
                  {formatMoeda(item.custo_ocioso)}
                  {!item.tem_valor_cadastrado && <SemValorDefinido />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Horas ociosas por causa">
        {dados.horas_ociosas_por_causa.length === 0 ? (
          <EmptyState>Nenhuma hora ociosa registrada no mês.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {dados.horas_ociosas_por_causa.map((item) => (
              <li key={item.motivo} className="flex items-center justify-between py-2 text-sm">
                <span>{item.motivo}</span>
                <span>{item.horas}h</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Faltas por pessoa">
        {dados.faltas_por_pessoa.length === 0 ? (
          <EmptyState>Nenhuma falta registrada no mês.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {dados.faltas_por_pessoa.map((item) => (
              <li key={item.pessoa_id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {item.nome} ({item.funcao})
                  {item.reincidente && (
                    <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-600">
                      reincidente
                    </span>
                  )}
                </span>
                <span>
                  {item.faltas} falta(s) — {formatMoeda(item.valor_perdido)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

export function CustosOciosidadePage() {
  const { projetoId } = useParams<{ projetoId: string }>()
  const { user } = useAuth()
  const [mes, setMes] = useState(mesAtualFiltro())
  const ehGerente = user?.perfil === 'gerente'
  const custos = useCustosOciosidade(projetoId ?? '', mes, ehGerente)

  if (!ehGerente) {
    return (
      <main aria-label="Custos e ociosidade">
        <PageHeader title="Custos & Ociosidade" breadcrumbs={[{ label: 'Custos & Ociosidade' }]} />
        <Alert>Esta tela é restrita ao perfil Gerente.</Alert>
      </main>
    )
  }

  return (
    <main aria-label="Custos e ociosidade">
      <PageHeader
        title="Custos & Ociosidade"
        breadcrumbs={[{ label: 'Custos & Ociosidade' }]}
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

      {custos.isLoading && <CustosOciosidadeSkeleton />}

      {custos.isError && (
        <ErrorRetry
          message="Não foi possível carregar os custos do mês."
          onRetry={() => void custos.refetch()}
        />
      )}

      {!custos.isLoading && !custos.isError && custos.data && (
        <CustosOciosidadeConteudo dados={custos.data} />
      )}
    </main>
  )
}
```

- [ ] **Step 5: Adicionar a rota**

Em `frontend/src/App.tsx`, adicionar o import junto aos demais:

```tsx
import { CustosOciosidadePage } from './pages/CustosOciosidadePage'
```

E adicionar a rota, logo após a de configurações:

```tsx
              <Route path="/projetos/:projetoId/configuracoes" element={<ConfiguracaoPage />} />
              <Route path="/projetos/:projetoId/custos-ociosidade" element={<CustosOciosidadePage />} />
```

- [ ] **Step 6: Adicionar o item no Sidebar, gated por perfil**

Em `frontend/src/layouts/Sidebar.tsx`, trocar o import e o corpo de `SidebarNav`:

```tsx
import { DollarSign, FileText, LayoutDashboard, LayoutGrid, Settings } from 'lucide-react'
import { NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface hover:text-ink'
  }`

export function SidebarNav() {
  const { projetoId } = useParams<{ projetoId?: string }>()
  const { user } = useAuth()

  return (
    <nav className="flex flex-col gap-1 p-3">
      <NavLink to="/dashboard" className={navItemClass}>
        <LayoutDashboard size={18} aria-hidden="true" />
        Dashboard
      </NavLink>
      <p className="px-3 pb-2 pt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Operação
      </p>
      <NavLink to="/projetos" className={navItemClass}>
        <LayoutGrid size={18} aria-hidden="true" />
        Projetos
      </NavLink>
      {projetoId && (
        <>
          <NavLink to={`/projetos/${projetoId}/registros-diarios`} className={navItemClass}>
            <FileText size={18} aria-hidden="true" />
            Registros diários
          </NavLink>
          <NavLink to={`/projetos/${projetoId}/configuracoes`} className={navItemClass}>
            <Settings size={18} aria-hidden="true" />
            Configurações
          </NavLink>
          {user?.perfil === 'gerente' && (
            <NavLink to={`/projetos/${projetoId}/custos-ociosidade`} className={navItemClass}>
              <DollarSign size={18} aria-hidden="true" />
              Custos & Ociosidade
            </NavLink>
          )}
        </>
      )}
    </nav>
  )
}
```

(Resto do arquivo, a função `Sidebar()`, continua idêntico.)

- [ ] **Step 7: Build e verificação manual de tipos**

Run: `cd frontend && npx tsc -b --noEmit && npm run build`
Expected: exit 0 nos dois.

- [ ] **Step 8: Escrever os testes E2E**

Criar `frontend/tests/e2e/custos-ociosidade.spec.ts`:

```typescript
import { expect, test } from '@playwright/test'

const SESSION_URL = '**/_allauth/browser/v1/auth/session'
const CONFIG_URL = '**/api/v1/projetos/*/configuracao/'
const CUSTOS_URL = '**/api/v1/projetos/*/custos-ociosidade/**'

const GERENTE = {
  id: '1',
  email: 'gerente@empresaA.example.com',
  nome: 'Gerente Empresa A',
  perfil: 'gerente',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const AUXILIAR = {
  id: '2',
  email: 'auxiliar@empresaA.example.com',
  nome: 'Auxiliar Empresa A',
  perfil: 'auxiliar_administrativo',
  empresa: 'uuid-empresa-a',
  empresa_nome: 'Empresa A',
}

const RESPOSTA_CUSTOS = {
  mes: '2026-07',
  custo_mao_de_obra: '5000.00',
  deficit_mao_de_obra: '250.00',
  custo_produtivo_maquinas: '12000.00',
  custo_ocioso_maquinas: '600.00',
  custo_total: '17000.00',
  ociosidade_evitavel_total: '850.00',
  horas_ociosas_total: '8.00',
  eficiencia_gerencial_percentual: 87,
  mao_de_obra_por_funcao: [
    {
      funcao: 'Ajudante',
      dias_trabalhados: 20,
      faltas: 1,
      atestados: 0,
      custo: '5000.00',
      deficit: '250.00',
      tem_valor_cadastrado: true,
    },
  ],
  maquinas_por_equipamento: [
    {
      maquina_id: 'maquina-1',
      codigo: 'ESC-01',
      nome: 'Escavadeira 320D',
      equipe_nome: 'Equipe 1',
      horas_produtivas: '160.00',
      horas_paradas: '8.00',
      custo_produtivo: '12000.00',
      custo_ocioso: '600.00',
      eficiencia_percentual: 95,
      tem_valor_cadastrado: true,
    },
  ],
  horas_ociosas_por_causa: [{ motivo: 'Chuva', horas: '8.00' }],
  faltas_por_pessoa: [
    {
      pessoa_id: 'pessoa-1',
      nome: 'José Ajudante',
      funcao: 'Ajudante',
      faltas: 3,
      atestados: 0,
      valor_perdido: '750.00',
      reincidente: true,
    },
  ],
}

test('gerente ve custos e ociosidade do projeto no mes', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  let ultimaUrlRequisitada = ''
  await page.route(CUSTOS_URL, (route) => {
    ultimaUrlRequisitada = route.request().url()
    return route.fulfill({ json: RESPOSTA_CUSTOS })
  })

  await page.goto('/projetos/projeto-1/custos-ociosidade')

  // Regex (nao string literal) porque Intl.NumberFormat pode render com
  // espaco normal ou nao-quebravel (U+00A0) entre "R$" e o valor, dependendo
  // da versao do ICU do Chromium — \s cobre os dois.
  await expect(page.getByText(/R\$\s*5\.000,00/)).toBeVisible()
  await expect(page.getByText(/R\$\s*17\.000,00/)).toBeVisible()
  await expect(page.getByText('87%')).toBeVisible()
  await expect(page.getByText('José Ajudante (Ajudante)')).toBeVisible()
  await expect(page.getByText('reincidente')).toBeVisible()
  expect(ultimaUrlRequisitada).toContain('mes=2026-07')

  await page.getByLabel('Mês de referência').fill('2026-08')
  await expect.poll(() => ultimaUrlRequisitada).toContain('mes=2026-08')
})

test('sem valor cadastrado mostra aviso em vez de custo inventado', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: GERENTE }, meta: { is_authenticated: true } } }),
  )
  await page.route(CUSTOS_URL, (route) =>
    route.fulfill({
      json: {
        ...RESPOSTA_CUSTOS,
        maquinas_por_equipamento: [
          { ...RESPOSTA_CUSTOS.maquinas_por_equipamento[0], tem_valor_cadastrado: false },
        ],
      },
    }),
  )

  await page.goto('/projetos/projeto-1/custos-ociosidade')

  await expect(page.getByText('sem valor definido')).toBeVisible()
})

test('auxiliar administrativo nao ve o item no menu e recebe acesso restrito na rota', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: AUXILIAR }, meta: { is_authenticated: true } } }),
  )
  await page.route(CONFIG_URL, (route) =>
    route.fulfill({ json: { disciplinas: [], equipes: [], metas: [], valores_custo: [], soma_pesos_metas: 0 } }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await expect(page.getByRole('link', { name: 'Custos & Ociosidade' })).not.toBeVisible()

  await page.goto('/projetos/projeto-1/custos-ociosidade')
  await expect(page.getByText('Esta tela é restrita ao perfil Gerente.')).toBeVisible()
})
```

- [ ] **Step 9: Rodar os testes novos**

Run: `cd frontend && npx playwright test tests/e2e/custos-ociosidade.spec.ts`
Expected: 3/3 passando.

- [ ] **Step 10: Regressão completa**

Run: `cd frontend && npx playwright test`
Expected: suíte completa passando.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/custoOciosidade.ts frontend/src/features/custos-ociosidade frontend/src/pages/CustosOciosidadePage.tsx frontend/src/lib/format.ts frontend/src/App.tsx frontend/src/layouts/Sidebar.tsx frontend/tests/e2e/custos-ociosidade.spec.ts
git commit -m "feat: adiciona pagina Custos & Ociosidade (frontend)"
```

---

### Task 5: Verificação final

**Files:** nenhum esperado além de possíveis pequenos ajustes achados na verificação.

- [ ] **Step 1: Suíte completa do backend**

```bash
cd backend
uv run ruff check .
uv run ruff format --check .
uv run python manage.py check
uv run pytest
```
Expected: todos exit 0; suíte pytest completa passando (nenhuma regressão nos módulos
existentes).

- [ ] **Step 2: Suíte completa do frontend**

```bash
cd frontend
npm run build
npm run lint
npm run test
npx playwright test
```
Expected: build exit 0, lint exit 0 (só warnings pré-existentes de fast-refresh), `npm run test`
reporta 0 testes (convenção já estabelecida), suíte Playwright completa passando.

- [ ] **Step 3: Rodar o seed de demonstração do zero e validar manualmente**

Run: `cd backend && uv run python manage.py seed_demo_data`
Expected: sucesso; confirmar manualmente (Django Admin ou `manage.py shell`) que o projeto
"Obra 1 — Construtora Alfa" tem 1 `ValorCusto` com `funcao="Ajudante"` e 1 com `maquina` setada,
e que existe 1 `Presenca`/`ApontamentoMaquina` no RDO seedado do mês atual.

- [ ] **Step 4: Atualizar `specs/001-mvp-gestao-diaria/tasks.md`**

Adicionar ao final do arquivo:

```markdown

**Backend + Frontend — Módulo Custos & Ociosidade (2026-07-21)**: primeiro módulo da expansão de
escopo além do MVP, seguindo o protótipo `EPR_Daily_Completo.html` (backlog já registrado em
`specs/001-mvp-gestao-diaria/spec.md`, seção Assumptions). `ValorCusto` ganha `funcao` (mão de
obra) e `maquina` (equipamento, FK), permitindo atribuir custo real por função/máquina —
`valor` fixado como R$/dia (mão de obra) e R$/hora (equipamento). Novo app `custos_ociosidade`
(somente leitura) cruza `Presenca`/`ApontamentoMaquina`/`ValorCusto`/`MotivoParada` já existentes
para calcular, por projeto e por mês: custo e déficit de mão de obra (falta gera déficit,
atestado não), custo e ociosidade de máquinas (por equipamento individual), eficiência gerencial,
horas ociosas por causa e faltas por pessoa (reincidência ≥3). Novo endpoint
`GET /api/v1/projetos/{id}/custos-ociosidade/?mes=YYYY-MM`, restrito ao perfil Gerente (primeira
restrição real por perfil do sistema — `IsGerente`, `core/permissions.py`). Nova página
`CustosOciosidadePage`, item no Sidebar visível só para Gerente. Fora de escopo desta rodada: EAP
completa, RNC, Medição, Histórico & Aprovações (módulos independentes do protótipo, cada um com
spec/plano próprio quando priorizado) e a visão comparativa entre todos os projetos da empresa
(mesmo cálculo, endpoint agregado — próximo passo natural).

**Verificado**: `uv run pytest` completo + `ruff check`/`format`, build + lint + suíte E2E
completa do frontend passando.
```

```bash
git add specs/001-mvp-gestao-diaria/tasks.md
git commit -m "docs: registra modulo Custos & Ociosidade em tasks.md"
```
