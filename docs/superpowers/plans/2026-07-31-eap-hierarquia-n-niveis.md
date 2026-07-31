# EAP — Hierarquia N-níveis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que `Disciplina` tenha subdisciplinas (profundidade arbitrária), com `CatalogoServico` continuando sempre como o nó-folha, e todos os cálculos de rollup (avanço, previsto, status, janela do Gantt) passando a considerar essa árvore recursivamente.

**Architecture:** `Disciplina` ganha um campo `pai` auto-referenciado e opcional (nulo = raiz). Backend: quatro funções de rollup em `projetos/services.py` passam a iterar filhos mistos (subdisciplinas + serviços); dois pontos de cálculo em nível de projeto são corrigidos para não contar peso de subdisciplina duas vezes; o serializer ganha um campo recursivo `subdisciplinas`. Frontend: `EapDisciplinaCard` vira recursivo (cartões aninhados), com um botão "+ Subdisciplina" por card; `GanttChart` achata a árvore antes de desenhar as barras.

**Tech Stack:** Django 6 / DRF (backend), React + TypeScript + `@tanstack/react-query` (frontend), pytest (backend tests), Playwright (e2e).

## Global Constraints

- `Disciplina.pai` é `ForeignKey('self', null=True, blank=True, on_delete=CASCADE, related_name='subdisciplinas')` — puramente aditivo, todo dado existente vira raiz (`pai=None`).
- `CatalogoServico` não muda em nada — continua sempre o nó-folha, em qualquer profundidade de disciplina.
- Profundidade é arbitrária (sem limite artificial), mas ciclos são proibidos (validado no serializer).
- `pai`, quando informado, deve pertencer ao mesmo projeto da disciplina — nunca confiar em FK vindo do cliente sem validar o tenant/projeto.
- UI: cartões aninhados (subdisciplina = card recuado dentro do card do pai) — decisão já validada visualmente com o usuário.
- Fora de escopo: código hierárquico (`001.001`), importação/exportação CSV/XLSX — ficam para uma spec futura.
- "Nunca inventa número": nenhuma função de rollup deve retornar um valor fabricado quando a base de dados for insuficiente — sempre `None` nesse caso, como já é o padrão no restante da EAP.

---

## Task 1: Modelo `Disciplina.pai` + validação de ciclo e projeto

**Files:**
- Modify: `backend/buildflow/configuracoes/models.py:40-78` (classe `Disciplina`)
- Create: `backend/buildflow/configuracoes/migrations/0011_disciplina_pai.py`
- Modify: `backend/buildflow/configuracoes/serializers.py:158-178` (classe `DisciplinaSerializer`)
- Modify: `backend/buildflow/configuracoes/views.py:119-139` (classe `DisciplinaViewSet`)
- Test: `backend/buildflow/configuracoes/tests/test_models.py`
- Test: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: nada de tarefas anteriores (primeira tarefa do plano).
- Produces: `Disciplina.pai` (FK opcional, `related_name='subdisciplinas'`); `DisciplinaSerializer` aceita e valida `pai` em create/update. Tarefas 2 e 3 dependem de `disciplina.subdisciplinas.all()` já existir e funcionar.

- [ ] **Step 1: Adicionar o campo `pai` ao modelo `Disciplina`**

Em `backend/buildflow/configuracoes/models.py`, dentro da classe `Disciplina` (linha 40), adicione o campo `pai` logo após `projeto` e antes de `nome`:

```python
class Disciplina(models.Model):
    """Catalogo aberto por projeto (X: BASE_EAP.DISCIPLINA / BASE_QTD_L2.DISCIPLINA).

    Nao e um enum fechado — cada projeto pode ter seu proprio conjunto de
    disciplinas (Fase 1/Descoberta, secao 7 do relatorio de campos).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    projeto = models.ForeignKey(
        Projeto,
        verbose_name=_("projeto"),
        on_delete=models.CASCADE,
        related_name="disciplinas",
    )
    pai = models.ForeignKey(
        "self",
        verbose_name=_("disciplina pai"),
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="subdisciplinas",
    )
    nome = models.CharField(_("nome"), max_length=255)
    peso_percentual = models.DecimalField(
        _("peso percentual"),
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
    )
```

O resto da classe (`tenant_path`, `objects`, `Meta`, `__str__`) não muda.

- [ ] **Step 2: Gerar e revisar a migração**

Rode:
```bash
cd backend && python manage.py makemigrations configuracoes
```

Confirme que o Django gerou um arquivo (ex.: `0011_disciplina_pai.py`) com conteúdo equivalente a:

```python
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0010_catalogoservico_datas_previstas'),
    ]

    operations = [
        migrations.AddField(
            model_name='disciplina',
            name='pai',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='subdisciplinas',
                to='configuracoes.disciplina',
                verbose_name='disciplina pai',
            ),
        ),
    ]
```

Se o nome do arquivo gerado for diferente, está tudo bem — apenas confirme que a operação é um `AddField` de `pai` como FK opcional para `configuracoes.disciplina` com `related_name='subdisciplinas'`.

Aplique a migração:
```bash
python manage.py migrate configuracoes
```
Esperado: `Applying configuracoes.0011_disciplina_pai... OK` (ou nome equivalente).

- [ ] **Step 3: Escrever os testes de modelo (cascade, raiz por padrão, relação)**

Em `backend/buildflow/configuracoes/tests/test_models.py`, adicione ao final do arquivo:

```python
def test_disciplina_e_raiz_por_padrao():
    projeto = _criar_projeto()
    disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")

    assert disciplina.pai is None


def test_disciplina_pode_ter_subdisciplina():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    filha = Disciplina.objects.create(
        projeto=projeto, nome="Movimento de Terra", pai=pai,
    )

    assert filha.pai_id == pai.id
    assert list(pai.subdisciplinas.all()) == [filha]


def test_deletar_disciplina_pai_remove_subdisciplinas_em_cascata():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    filha = Disciplina.objects.create(
        projeto=projeto, nome="Movimento de Terra", pai=pai,
    )

    pai.delete()

    assert not Disciplina.objects.filter(id=filha.id).exists()
```

- [ ] **Step 4: Rodar os testes de modelo e confirmar que passam**

```bash
cd backend && pytest buildflow/configuracoes/tests/test_models.py -v
```
Esperado: todos os testes (os 4 já existentes + os 3 novos) `PASSED`.

- [ ] **Step 5: Adicionar `pai` ao `DisciplinaSerializer` com validação de ciclo e de projeto**

Em `backend/buildflow/configuracoes/serializers.py`, substitua a classe `DisciplinaSerializer` inteira (linhas 158-207) por:

```python
class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()
    data_inicio_prevista = serializers.SerializerMethodField()
    data_fim_prevista = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "pai",
            "servicos",
            "avanco_percentual",
            "avanco_previsto_percentual",
            "status_eap",
            "data_inicio_prevista",
            "data_fim_prevista",
        ]

    def validate_pai(self, pai: Disciplina | None) -> Disciplina | None:
        if pai is None:
            return pai

        projeto_id = self.instance.projeto_id if self.instance else self.context["projeto"].id
        if pai.projeto_id != projeto_id:
            msg = "A disciplina pai deve pertencer ao mesmo projeto."
            raise serializers.ValidationError(msg)

        if self.instance is not None:
            cursor: Disciplina | None = pai
            while cursor is not None:
                if cursor.id == self.instance.id:
                    msg = "Uma disciplina não pode ser sua própria ancestral."
                    raise serializers.ValidationError(msg)
                cursor = cursor.pai

        return pai

    def _avanco_real(self, obj: Disciplina) -> Decimal | None:
        cache = self.context.setdefault("_avanco_real_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_avanco_disciplina(obj)
        return cache[obj.pk]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(self._avanco_real(obj))

    def get_avanco_previsto_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_disciplina(obj))

    def get_status_eap(self, obj: Disciplina) -> str | None:
        return calcular_status_eap_disciplina(obj)

    def _janela(self, obj: Disciplina) -> tuple[datetime.date, datetime.date] | None:
        cache = self.context.setdefault("_janela_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_janela_disciplina(obj)
        return cache[obj.pk]

    def get_data_inicio_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[0].isoformat() if janela else None

    def get_data_fim_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[1].isoformat() if janela else None
```

(O campo `subdisciplinas` recursivo entra na Tarefa 3 — esta tarefa cuida só do campo `pai` e sua validação.)

- [ ] **Step 6: Passar o `projeto` no contexto do serializer ao criar disciplina**

Em `backend/buildflow/configuracoes/views.py`, na classe `DisciplinaViewSet` (linha 119), adicione o método `get_serializer_context`:

```python
class DisciplinaViewSet(
    TenantScopedViewSetMixin,
    ProjetoNestedMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    GenericViewSet,
):
    serializer_class = DisciplinaSerializer
    queryset = Disciplina.objects.all().prefetch_related("servicos")

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticatedWithEmpresa(), IsGerente()]
        return [IsAuthenticatedWithEmpresa()]

    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["projeto"] = self._get_projeto()
        return context

    def perform_create(self, serializer):
        serializer.save(projeto=self._get_projeto())
```

- [ ] **Step 7: Escrever os testes de API (criar com pai, rejeitar cross-projeto, rejeitar ciclo)**

Em `backend/buildflow/configuracoes/tests/test_api.py`, adicione:

```python
def test_criar_subdisciplina_com_pai():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    pai = DisciplinaFactory(projeto=projeto, nome="Terraplenagem")
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/disciplinas/",
        {"nome": "Movimento de Terra", "pai": str(pai.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.CREATED, response.data
    assert response.json()["pai"] == str(pai.id)


def test_criar_disciplina_com_pai_de_outro_projeto_e_rejeitada():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    outro_projeto = ProjetoParaRdoFactory(criado_por=usuario)
    pai_de_outro_projeto = DisciplinaFactory(projeto=outro_projeto)
    client = _authenticated_client(usuario)

    response = client.post(
        f"/api/v1/projetos/{projeto.id}/configuracao/disciplinas/",
        {"nome": "Movimento de Terra", "pai": str(pai_de_outro_projeto.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_patch_disciplina_pai_de_si_mesma_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    disciplina = DisciplinaFactory(projeto=projeto)
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/disciplinas/{disciplina.id}/",
        {"pai": str(disciplina.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_patch_disciplina_pai_formando_ciclo_indireto_e_rejeitado():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    avo = DisciplinaFactory(projeto=projeto, nome="Terraplenagem")
    pai = DisciplinaFactory(projeto=projeto, nome="Movimento de Terra", pai=avo)
    client = _authenticated_client(usuario)

    response = client.patch(
        f"/api/v1/configuracoes/disciplinas/{avo.id}/",
        {"pai": str(pai.id)},
        format="json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST
```

- [ ] **Step 8: Rodar os testes de API e confirmar que passam**

```bash
cd backend && pytest buildflow/configuracoes/tests/test_api.py -v
```
Esperado: todos os testes (os já existentes + os 4 novos) `PASSED`.

- [ ] **Step 9: Commit**

```bash
git add backend/buildflow/configuracoes/models.py \
        backend/buildflow/configuracoes/migrations/0011_disciplina_pai.py \
        backend/buildflow/configuracoes/serializers.py \
        backend/buildflow/configuracoes/views.py \
        backend/buildflow/configuracoes/tests/test_models.py \
        backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: adiciona pai opcional a Disciplina para subdisciplinas em N niveis"
```

---

## Task 2: Rollup recursivo + correção de double-counting no nível de projeto

**Files:**
- Modify: `backend/buildflow/projetos/services.py` (funções `calcular_avanco_disciplina`, `calcular_avanco_previsto_disciplina`, `calcular_status_eap_disciplina`, `calcular_janela_disciplina`, `calcular_execucao_percentual`)
- Modify: `backend/buildflow/configuracoes/services.py` (`soma_pesos_disciplinas`)
- Test: `backend/buildflow/projetos/tests/test_execucao.py`
- Create: `backend/buildflow/configuracoes/tests/test_services.py`

**Interfaces:**
- Consumes: `Disciplina.pai`/`Disciplina.subdisciplinas` (Task 1).
- Produces: `calcular_avanco_disciplina`, `calcular_avanco_previsto_disciplina`, `calcular_status_eap_disciplina`, `calcular_janela_disciplina` — mesmas assinaturas de antes, agora recursivas. Nova função privada `_servicos_leaf(disciplina) -> list[CatalogoServico]`. Task 3 (serializer) continua chamando essas funções com as mesmas assinaturas, sem mudança de interface.

- [ ] **Step 1: Tornar `calcular_avanco_disciplina` recursivo**

Em `backend/buildflow/projetos/services.py`, substitua a função (linhas 140-160) por:

```python
def calcular_avanco_disciplina(disciplina: Disciplina) -> Decimal | None:
    """Media ponderada (por peso_percentual) do avanco dos filhos de uma
    disciplina -- subdisciplinas e servicos contam igual, cada um com seu
    proprio avanco ja calculado (recursivo pelas subdisciplinas). Filho sem
    peso definido ou sem avanco calculavel nao conta. Retorna None quando
    nenhum filho conta.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for subdisciplina in disciplina.subdisciplinas.all():
        if subdisciplina.peso_percentual is None:
            continue
        avanco = calcular_avanco_disciplina(subdisciplina)
        if avanco is None:
            continue
        soma_ponderada += avanco * subdisciplina.peso_percentual
        soma_pesos += subdisciplina.peso_percentual

    for servico in disciplina.servicos.all():
        if servico.peso_percentual is None:
            continue
        avanco = calcular_avanco_servico(servico)
        if avanco is None:
            continue
        soma_ponderada += avanco * servico.peso_percentual
        soma_pesos += servico.peso_percentual

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
```

- [ ] **Step 2: Tornar `calcular_avanco_previsto_disciplina` recursivo**

Substitua a função (logo abaixo, antes era linhas 185-204) por:

```python
def calcular_avanco_previsto_disciplina(
    disciplina: Disciplina,
    hoje: datetime.date | None = None,
) -> Decimal | None:
    """Media ponderada (por peso_percentual) do avanco previsto dos filhos da
    disciplina -- subdisciplinas e servicos, recursivo. Filho sem peso ou sem
    previsto (datas ausentes) nao conta.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for subdisciplina in disciplina.subdisciplinas.all():
        if subdisciplina.peso_percentual is None:
            continue
        previsto = calcular_avanco_previsto_disciplina(subdisciplina, hoje)
        if previsto is None:
            continue
        soma_ponderada += previsto * subdisciplina.peso_percentual
        soma_pesos += subdisciplina.peso_percentual

    for servico in disciplina.servicos.all():
        if servico.peso_percentual is None:
            continue
        previsto = calcular_avanco_previsto_servico(servico, hoje)
        if previsto is None:
            continue
        soma_ponderada += previsto * servico.peso_percentual
        soma_pesos += servico.peso_percentual

    if soma_pesos == 0:
        return None
    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
```

- [ ] **Step 3: Adicionar `_servicos_leaf` e tornar `calcular_status_eap_disciplina`/`calcular_janela_disciplina` recursivos**

Substitua as duas funções (originalmente linhas 230-274) por:

```python
def _servicos_leaf(disciplina: Disciplina) -> list[CatalogoServico]:
    """Todos os servicos-folha descendentes de uma disciplina, em qualquer
    profundidade (recursivo pelas subdisciplinas).
    """
    servicos = list(disciplina.servicos.all())
    for subdisciplina in disciplina.subdisciplinas.all():
        servicos.extend(_servicos_leaf(subdisciplina))
    return servicos


def calcular_status_eap_disciplina(disciplina: Disciplina) -> StatusEapChoices | None:
    """Status da disciplina, mas so quando o avanco real e o avanco previsto
    forem calculados sobre o mesmo conjunto de servicos-folha de toda a
    subarvore (recursivo por subdisciplinas). Bases diferentes (ex.: um
    servico so tem quantidade_planejada, outro so tem datas previstas)
    tornam a comparacao sem sentido — retorna None em vez de um status
    enganoso, mesmo principio de "nunca inventa numero".
    """
    servicos_com_peso = [
        s for s in _servicos_leaf(disciplina) if s.peso_percentual is not None
    ]
    ids_com_avanco_real = {
        s.id for s in servicos_com_peso if calcular_avanco_servico(s) is not None
    }
    ids_com_avanco_previsto = {
        s.id
        for s in servicos_com_peso
        if calcular_avanco_previsto_servico(s) is not None
    }
    if ids_com_avanco_real != ids_com_avanco_previsto:
        return None
    return classificar_status_eap(
        calcular_avanco_disciplina(disciplina),
        calcular_avanco_previsto_disciplina(disciplina),
    )


def calcular_janela_disciplina(
    disciplina: Disciplina,
) -> tuple[datetime.date, datetime.date] | None:
    """Janela (inicio, fim) de uma disciplina para o Gantt: menor
    data_inicio_prevista e maior data_fim_prevista entre os servicos-folha
    descendentes (em qualquer profundidade, via subdisciplinas) que tem
    ambas as datas definidas. Sem nenhum servico com as duas datas, retorna
    None -- disciplina nao aparece no Gantt, nunca inventa uma janela.
    """
    servicos_com_janela = [
        s
        for s in _servicos_leaf(disciplina)
        if s.data_inicio_prevista is not None and s.data_fim_prevista is not None
    ]
    if not servicos_com_janela:
        return None
    return (
        min(s.data_inicio_prevista for s in servicos_com_janela),
        max(s.data_fim_prevista for s in servicos_com_janela),
    )
```

- [ ] **Step 4: Corrigir `calcular_execucao_percentual` para não contar peso de subdisciplina duas vezes**

Substitua a função (originalmente linhas 277-298) por:

```python
def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    """Media ponderada (por Disciplina.peso_percentual) do avanco de cada
    disciplina RAIZ do projeto. Subdisciplinas nao contam aqui -- seu peso ja
    esta embutido no rollup recursivo do proprio pai; contar de novo neste
    nivel duplicaria. Disciplina sem peso definido nao conta. Retorna None
    quando nao ha base real para calcular -- nunca inventa um numero.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for disciplina in projeto.disciplinas.filter(pai__isnull=True):
        if disciplina.peso_percentual is None:
            continue
        avanco = calcular_avanco_disciplina(disciplina)
        if avanco is None:
            continue
        soma_ponderada += avanco * disciplina.peso_percentual
        soma_pesos += disciplina.peso_percentual

    if soma_pesos == 0:
        return None

    return (soma_ponderada / soma_pesos).quantize(Decimal("0.01"))
```

- [ ] **Step 5: Corrigir `soma_pesos_disciplinas` (configuracoes/services.py) com o mesmo raciocínio**

Substitua o conteúdo inteiro de `backend/buildflow/configuracoes/services.py` por:

```python
from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError


def soma_pesos_disciplinas(projeto) -> Decimal:
    """Soma dos pesos percentuais das disciplinas RAIZ de um projeto.
    Subdisciplinas nao contam aqui -- seu peso e relativo ao proprio pai
    (dentro do pool de peso do pai), nao ao projeto; contar aqui duplicaria.

    Validacao informativa (nao bloqueante): o frontend usa isso so para
    alertar visualmente quando a soma nao fica proxima de 100%, sem impedir
    o salvamento (H: a planilha de EAP do prototipo so validava
    visualmente, nunca travava o cadastro).
    """
    total = Decimal("0")
    for disciplina in projeto.disciplinas.filter(pai__isnull=True):
        if disciplina.peso_percentual is not None:
            total += disciplina.peso_percentual
    return total


def validar_valor_custo(*, tipo: str, funcao: str, maquina) -> None:
    if tipo == "mao_de_obra" and maquina is not None:
        msg = _("Máquina só pode ser informada quando o tipo é Equipamento.")
        raise ValidationError(msg)
    if tipo == "equipamento" and funcao:
        msg = _("Função só pode ser informada quando o tipo é Mão de obra.")
        raise ValidationError(msg)
```

- [ ] **Step 6: Escrever os testes de rollup recursivo e da correção de double-counting**

Em `backend/buildflow/projetos/tests/test_execucao.py`, adicione ao final:

```python
def test_calcula_avanco_disciplina_com_subdisciplina_e_servico_misturados():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    filha = Disciplina.objects.create(
        projeto=projeto,
        nome="Movimento de Terra",
        pai=pai,
        peso_percentual=Decimal("50.00"),
    )
    CatalogoServico.objects.create(
        disciplina=filha,
        nome="Escavação",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("100.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("800.000"),
    )
    CatalogoServico.objects.create(
        disciplina=pai,
        nome="Compactação",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("50.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("200.000"),
    )

    # filha: 1 servico com peso 100, avanco 800/1000 = 80.00
    assert calcular_avanco_disciplina(filha) == Decimal("80.00")
    # pai: filha (peso 50, avanco 80) + servico direto (peso 50, avanco 20)
    # -> (50*80 + 50*20) / 100 = 50.00
    assert calcular_avanco_disciplina(pai) == Decimal("50.00")


def test_execucao_percentual_projeto_ignora_peso_de_subdisciplina():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    filha = Disciplina.objects.create(
        projeto=projeto,
        nome="Movimento de Terra",
        pai=pai,
        peso_percentual=Decimal("50.00"),
    )
    CatalogoServico.objects.create(
        disciplina=filha,
        nome="Escavação",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("100.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("800.000"),
    )
    CatalogoServico.objects.create(
        disciplina=pai,
        nome="Compactação",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("50.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("200.000"),
    )

    # pai: filha (peso 50, avanco 80) + servico direto (peso 50, avanco 20)
    # -> (50*80 + 50*20) / 100 = 50.00 (ver teste anterior)
    assert calcular_avanco_disciplina(pai) == Decimal("50.00")

    # Sem a correcao, projeto.disciplinas.all() tambem incluiria "filha" com
    # seu peso_percentual (50, relativo ao PAI, nao ao projeto) contando de
    # novo no nivel de projeto -- resultado errado seria 60.00 em vez de
    # 50.00: (100*50 + 50*80) / (100+50) = 9000/150 = 60.00.
    assert calcular_execucao_percentual(projeto) == Decimal("50.00")


def test_status_eap_disciplina_considera_servicos_folha_de_subdisciplina():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    filha = Disciplina.objects.create(
        projeto=projeto,
        nome="Movimento de Terra",
        pai=pai,
        peso_percentual=Decimal("100.00"),
    )
    CatalogoServico.objects.create(
        disciplina=filha,
        nome="Escavação",
        unidade=_criar_unidade(),
        peso_percentual=Decimal("100.00"),
        quantidade_planejada=Decimal("1000.000"),
        quantidade_executada_manual=Decimal("1000.000"),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 1, 31),
    )

    # Servico-folha (dentro da subdisciplina, sem nenhum servico direto no
    # pai) 100% executado e com datas ja no passado -> real >=
    # LIMIAR_CONCLUIDO classifica CONCLUIDO independente da data de "hoje"
    # em que o teste roda (mesmo truque de
    # test_status_eap_disciplina_retorna_status_real_quando_bases_coincidem,
    # que evita ter que mockar timezone.now()). Isso confirma que o status
    # do pai enxerga o servico-folha dentro da subdisciplina.
    assert calcular_status_eap_disciplina(pai) == StatusEapChoices.CONCLUIDO


def test_janela_disciplina_considera_servicos_de_subdisciplina():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
    filha = Disciplina.objects.create(
        projeto=projeto, nome="Movimento de Terra", pai=pai,
    )
    CatalogoServico.objects.create(
        disciplina=filha,
        nome="Escavação",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 2, 1),
        data_fim_prevista=datetime.date(2026, 5, 1),
    )
    CatalogoServico.objects.create(
        disciplina=pai,
        nome="Compactação",
        unidade=_criar_unidade(),
        data_inicio_prevista=datetime.date(2026, 1, 1),
        data_fim_prevista=datetime.date(2026, 3, 1),
    )

    assert calcular_janela_disciplina(pai) == (
        datetime.date(2026, 1, 1),
        datetime.date(2026, 5, 1),
    )
```

No topo do arquivo, adicione `StatusEapChoices` aos imports já existentes se ainda não estiver lá (já está, conforme linha 12 do arquivo atual — confirme antes de duplicar o import).

- [ ] **Step 7: Rodar os testes e confirmar que passam**

```bash
cd backend && pytest buildflow/projetos/tests/test_execucao.py -v
```
Esperado: todos os testes (existentes + os 4 novos) `PASSED`.

- [ ] **Step 8: Criar teste dedicado para `soma_pesos_disciplinas`**

Crie `backend/buildflow/configuracoes/tests/test_services.py`:

```python
from decimal import Decimal

import pytest

from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.services import soma_pesos_disciplinas
from buildflow.core.tests.factories import UsuarioFactory
from buildflow.projetos.models import Projeto

pytestmark = pytest.mark.django_db


def _criar_projeto() -> Projeto:
    usuario = UsuarioFactory()
    return Projeto.objects.create(
        empresa=usuario.empresa, nome="Projeto Teste", criado_por=usuario,
    )


def test_soma_pesos_disciplinas_ignora_subdisciplinas():
    projeto = _criar_projeto()
    pai = Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("100.00"),
    )
    Disciplina.objects.create(
        projeto=projeto,
        nome="Movimento de Terra",
        pai=pai,
        peso_percentual=Decimal("60.00"),
    )

    assert soma_pesos_disciplinas(projeto) == Decimal("100.00")


def test_soma_pesos_disciplinas_soma_so_raizes():
    projeto = _criar_projeto()
    Disciplina.objects.create(
        projeto=projeto, nome="Terraplenagem", peso_percentual=Decimal("60.00"),
    )
    Disciplina.objects.create(
        projeto=projeto, nome="Drenagem", peso_percentual=Decimal("40.00"),
    )

    assert soma_pesos_disciplinas(projeto) == Decimal("100.00")
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

```bash
cd backend && pytest buildflow/configuracoes/tests/test_services.py -v
```
Esperado: 2 `PASSED`.

- [ ] **Step 10: Rodar a suíte inteira do backend para checar regressões**

```bash
cd backend && pytest
```
Esperado: nenhuma falha nova em relação ao estado anterior à tarefa.

- [ ] **Step 11: Commit**

```bash
git add backend/buildflow/projetos/services.py \
        backend/buildflow/configuracoes/services.py \
        backend/buildflow/projetos/tests/test_execucao.py \
        backend/buildflow/configuracoes/tests/test_services.py
git commit -m "fix: torna rollup da EAP recursivo e corrige duplicacao de peso no nivel de projeto"
```

---

## Task 3: API — campo recursivo `subdisciplinas` no serializer

**Files:**
- Modify: `backend/buildflow/configuracoes/serializers.py` (`DisciplinaSerializer`)
- Modify: `backend/buildflow/configuracoes/views.py` (`ConfiguracaoProjetoView.get`, `DisciplinaViewSet.get_queryset`)
- Test: `backend/buildflow/configuracoes/tests/test_api.py`

**Interfaces:**
- Consumes: `DisciplinaSerializer` de Task 1 (campo `pai` + validação), funções de rollup recursivas de Task 2.
- Produces: `DisciplinaSerializer` agora inclui `subdisciplinas: list[dict]` (mesma forma recursiva) na resposta de leitura. Task 4 (frontend) consome esse campo diretamente.

- [ ] **Step 1: Adicionar `subdisciplinas` ao `DisciplinaSerializer`**

Em `backend/buildflow/configuracoes/serializers.py`, a classe `DisciplinaSerializer` está exatamente como escrita na Task 1 (Step 5). Localize este trecho exato (o início da classe):

```python
class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()
    data_inicio_prevista = serializers.SerializerMethodField()
    data_fim_prevista = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "pai",
            "servicos",
            "avanco_percentual",
            "avanco_previsto_percentual",
            "status_eap",
            "data_inicio_prevista",
            "data_fim_prevista",
        ]

    def validate_pai(self, pai: Disciplina | None) -> Disciplina | None:
```

E substitua por (adiciona `subdisciplinas` como campo e no `Meta.fields`, adiciona o método `get_subdisciplinas`, mantém `validate_pai` como está — só a linha de assinatura reaparece para ancorar o fim do trecho substituído):

```python
class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    subdisciplinas = serializers.SerializerMethodField()
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()
    data_inicio_prevista = serializers.SerializerMethodField()
    data_fim_prevista = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "pai",
            "servicos",
            "subdisciplinas",
            "avanco_percentual",
            "avanco_previsto_percentual",
            "status_eap",
            "data_inicio_prevista",
            "data_fim_prevista",
        ]

    def get_subdisciplinas(self, obj: Disciplina) -> list[dict]:
        return DisciplinaSerializer(
            obj.subdisciplinas.all(), many=True, context=self.context,
        ).data

    def validate_pai(self, pai: Disciplina | None) -> Disciplina | None:
```

O restante do método `validate_pai` e tudo depois dele (`_avanco_real`, `get_avanco_percentual`, `get_avanco_previsto_percentual`, `get_status_eap`, `_janela`, `get_data_inicio_prevista`, `get_data_fim_prevista`) não muda — a substituição acima afeta só até a linha de assinatura de `validate_pai`, mantendo o corpo do método intacto.

- [ ] **Step 2: Filtrar disciplinas raiz e ajustar prefetch em `ConfiguracaoProjetoView`**

Em `backend/buildflow/configuracoes/views.py`, na classe `ConfiguracaoProjetoView.get` (linha 92), troque:

```python
        disciplinas = Disciplina.objects.filter(projeto=projeto).prefetch_related(
            "servicos",
        )
```

por:

```python
        disciplinas = Disciplina.objects.filter(
            projeto=projeto, pai__isnull=True,
        ).prefetch_related("servicos", "subdisciplinas__servicos")
```

Nota: o `prefetch_related` cobre 2 níveis de profundidade explicitamente; profundidades maiores fazem 1 query extra por nó (mesmo padrão de N+1 já aceito em outros pontos do cálculo de status da EAP — não é uma regressão de performance nova, é o mesmo trade-off já existente).

- [ ] **Step 3: Filtrar disciplinas raiz também no `DisciplinaViewSet` (consistência; endpoint hoje não é consumido pelo frontend, mas deve continuar correto)**

Em `backend/buildflow/configuracoes/views.py`, troque o `get_queryset` de `DisciplinaViewSet`:

```python
    def get_queryset(self):
        return super().get_queryset().filter(projeto_id=self.kwargs["projeto_pk"])
```

por:

```python
    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(projeto_id=self.kwargs["projeto_pk"], pai__isnull=True)
        )
```

- [ ] **Step 4: Escrever teste de API confirmando a árvore aninhada na resposta**

Em `backend/buildflow/configuracoes/tests/test_api.py`, adicione:

```python
def test_configuracao_projeto_retorna_subdisciplinas_aninhadas():
    usuario = UsuarioFactory()
    projeto = ProjetoParaRdoFactory(criado_por=usuario)
    pai = DisciplinaFactory(projeto=projeto, nome="Terraplenagem")
    DisciplinaFactory(projeto=projeto, nome="Movimento de Terra", pai=pai)
    client = _authenticated_client(usuario)

    response = client.get(f"/api/v1/projetos/{projeto.id}/configuracao/")

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert len(body["disciplinas"]) == 1
    assert body["disciplinas"][0]["nome"] == "Terraplenagem"
    assert len(body["disciplinas"][0]["subdisciplinas"]) == 1
    assert body["disciplinas"][0]["subdisciplinas"][0]["nome"] == "Movimento de Terra"
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

```bash
cd backend && pytest buildflow/configuracoes/tests/test_api.py -v
```
Esperado: todos os testes (existentes + os 5 novos entre Task 1 e esta) `PASSED`.

- [ ] **Step 6: Rodar a suíte inteira do backend novamente**

```bash
cd backend && pytest
```
Esperado: nenhuma falha.

- [ ] **Step 7: Commit**

```bash
git add backend/buildflow/configuracoes/serializers.py \
        backend/buildflow/configuracoes/views.py \
        backend/buildflow/configuracoes/tests/test_api.py
git commit -m "feat: expoe arvore de subdisciplinas aninhada na API da EAP"
```

---

## Task 4: Frontend — cartões aninhados, criação de subdisciplina e Gantt achatado

**Files:**
- Modify: `frontend/src/types/configuracao.ts`
- Modify: `frontend/src/features/configuracoes/configuracaoApi.ts`
- Modify: `frontend/src/features/configuracoes/EapDisciplinaCard.tsx`
- Modify: `frontend/src/features/configuracoes/GanttChart.tsx`
- Modify: `frontend/tests/e2e/config.spec.ts`

**Interfaces:**
- Consumes: API de Task 3 — `Disciplina` agora tem `pai: string | null` e `subdisciplinas: Disciplina[]`.
- Produces: `EapDisciplinaCard` recursivo (nada consome isso depois — é a última tarefa do plano).

- [ ] **Step 1: Atualizar o tipo `Disciplina`**

Em `frontend/src/types/configuracao.ts`, troque a interface `Disciplina` (linhas 41-51):

```typescript
export interface Disciplina {
  id: string
  nome: string
  peso_percentual: string | null
  pai: string | null
  servicos: CatalogoServico[]
  subdisciplinas: Disciplina[]
  avanco_percentual: string | null
  avanco_previsto_percentual: string | null
  status_eap: StatusEap | null
  data_inicio_prevista: string | null
  data_fim_prevista: string | null
}
```

- [ ] **Step 2: `useCriarDisciplina` aceita `pai` opcional**

Em `frontend/src/features/configuracoes/configuracaoApi.ts`, troque:

```typescript
export function useCriarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: { nome: string; peso_percentual?: string }) =>
      apiClient.post<Disciplina>(`/api/v1/projetos/${projetoId}/configuracao/disciplinas/`, values),
    onSuccess: invalidar,
  })
}
```

por:

```typescript
export function useCriarDisciplina(projetoId: string) {
  const invalidar = useInvalidarConfiguracao(projetoId)
  return useMutation({
    mutationFn: (values: { nome: string; peso_percentual?: string; pai?: string }) =>
      apiClient.post<Disciplina>(`/api/v1/projetos/${projetoId}/configuracao/disciplinas/`, values),
    onSuccess: invalidar,
  })
}
```

- [ ] **Step 3: Tornar `EapDisciplinaCard` recursivo, com botão "+ Subdisciplina"**

Substitua o conteúdo inteiro de `frontend/src/features/configuracoes/EapDisciplinaCard.tsx` por:

```tsx
import { ChevronDown, ChevronRight, ListChecks } from 'lucide-react'
import { useState } from 'react'
import { toast } from '../../hooks/use-toast'
import { execucaoCorClasse, formatData, formatExecucao, statusEapCorClasse, statusEapLabel } from '../../lib/format'
import type { CatalogoServico, Disciplina } from '../../types/configuracao'
import type { Unidade } from '../../types/registroDiario'
import { Button, FormField, Input, Progress, SelectField } from '../../components/ui'
import { CartaControleChart } from './CartaControleChart'
import { useAtualizarDisciplina, useAtualizarServico, useCriarDisciplina, useCriarServico } from './configuracaoApi'

const TOLERANCIA_SOMA_PESOS = 0.01

function somaPesosFilhos(disciplina: Disciplina): number {
  const somaServicos = disciplina.servicos.reduce(
    (total, servico) => total + (servico.peso_percentual ? Number(servico.peso_percentual) : 0),
    0,
  )
  const somaSubdisciplinas = disciplina.subdisciplinas.reduce(
    (total, subdisciplina) => total + (subdisciplina.peso_percentual ? Number(subdisciplina.peso_percentual) : 0),
    0,
  )
  return somaServicos + somaSubdisciplinas
}

interface EapDisciplinaCardProps {
  projetoId: string
  disciplina: Disciplina
  unidades: Unidade[]
}

export function EapDisciplinaCard({ projetoId, disciplina, unidades }: EapDisciplinaCardProps) {
  const [expandido, setExpandido] = useState(false)
  const [peso, setPeso] = useState(disciplina.peso_percentual ?? '')
  const [novoServicoNome, setNovoServicoNome] = useState('')
  const [novoServicoUnidade, setNovoServicoUnidade] = useState('')
  const [novoServicoPeso, setNovoServicoPeso] = useState('')
  const [novoServicoQuantidade, setNovoServicoQuantidade] = useState('')
  const [novaSubdisciplinaNome, setNovaSubdisciplinaNome] = useState('')

  const atualizarDisciplina = useAtualizarDisciplina(projetoId)
  const criarServico = useCriarServico(projetoId)
  const criarDisciplina = useCriarDisciplina(projetoId)

  const somaFilhos = somaPesosFilhos(disciplina)
  const temFilhos = disciplina.servicos.length > 0 || disciplina.subdisciplinas.length > 0
  const somaFilhosForaDoAlvo = temFilhos && Math.abs(somaFilhos - 100) > TOLERANCIA_SOMA_PESOS

  function salvarPesoDisciplina() {
    if (peso === (disciplina.peso_percentual ?? '')) return
    atualizarDisciplina.mutate(
      { disciplinaId: disciplina.id, peso_percentual: peso },
      { onError: () => toast({ title: 'Não foi possível atualizar o peso da disciplina.', variant: 'destructive' }) },
    )
  }

  return (
    <li className="rounded-lg border border-border p-3 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setExpandido((valor) => !valor)}
          aria-expanded={expandido}
          aria-label={expandido ? `Recolher ${disciplina.nome}` : `Expandir ${disciplina.nome}`}
          className="text-muted-foreground hover:text-ink"
        >
          {expandido ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>
        <ListChecks size={14} className="text-primary" aria-hidden="true" />
        <span className="flex-1 font-display font-semibold">{disciplina.nome}</span>
        <div className="flex w-40 items-center gap-2">
          <Progress
            value={disciplina.avanco_percentual ? Number(disciplina.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(disciplina.avanco_percentual)}
          />
          <span className="w-12 text-right text-xs text-muted-foreground">
            {formatExecucao(disciplina.avanco_percentual)}
          </span>
          {disciplina.status_eap !== null && (
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(disciplina.status_eap)}`}
            >
              {statusEapLabel(disciplina.status_eap)}
            </span>
          )}
        </div>
        <FormField id={`peso-disciplina-${disciplina.id}`} label="Peso (%)" className="mb-0 w-24">
          <Input
            id={`peso-disciplina-${disciplina.id}`}
            value={peso}
            onChange={(event) => setPeso(event.target.value)}
            onBlur={salvarPesoDisciplina}
          />
        </FormField>
      </div>

      {expandido && (
        <div className="mt-3 pl-7">
          {!temFilhos && (
            <p className="mb-3 text-xs text-muted-foreground">
              Nenhuma subdisciplina ou serviço cadastrado nesta disciplina ainda.
            </p>
          )}

          {disciplina.subdisciplinas.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {disciplina.subdisciplinas.map((subdisciplina) => (
                <EapDisciplinaCard
                  key={subdisciplina.id}
                  projetoId={projetoId}
                  disciplina={subdisciplina}
                  unidades={unidades}
                />
              ))}
            </ul>
          )}

          {disciplina.servicos.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {disciplina.servicos.map((servico) => (
                <EapServicoRow key={servico.id} projetoId={projetoId} servico={servico} />
              ))}
            </ul>
          )}

          {somaFilhosForaDoAlvo && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
              Atenção: a soma dos pesos dos filhos desta disciplina não fecha 100% ({somaFilhos}%).
            </p>
          )}

          <div className="mb-3 flex flex-wrap items-end gap-3">
            <FormField id={`nova-subdisciplina-${disciplina.id}`} label="Nova subdisciplina">
              <Input
                id={`nova-subdisciplina-${disciplina.id}`}
                value={novaSubdisciplinaNome}
                onChange={(event) => setNovaSubdisciplinaNome(event.target.value)}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              disabled={!novaSubdisciplinaNome.trim() || criarDisciplina.isPending}
              onClick={() =>
                criarDisciplina.mutate(
                  { nome: novaSubdisciplinaNome, pai: disciplina.id },
                  {
                    onSuccess: () => setNovaSubdisciplinaNome(''),
                    onError: () =>
                      toast({ title: 'Não foi possível criar a subdisciplina.', variant: 'destructive' }),
                  },
                )
              }
            >
              + Subdisciplina
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <SelectField
              id={`novo-servico-unidade-${disciplina.id}`}
              label="Unidade"
              value={novoServicoUnidade}
              onChange={setNovoServicoUnidade}
              options={unidades.map((unidade) => ({ value: String(unidade.id), label: unidade.sigla }))}
            />
            <FormField id={`novo-servico-nome-${disciplina.id}`} label="Novo serviço">
              <Input
                id={`novo-servico-nome-${disciplina.id}`}
                value={novoServicoNome}
                onChange={(event) => setNovoServicoNome(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-peso-${disciplina.id}`} label="Peso (%)">
              <Input
                id={`novo-servico-peso-${disciplina.id}`}
                value={novoServicoPeso}
                onChange={(event) => setNovoServicoPeso(event.target.value)}
              />
            </FormField>
            <FormField id={`novo-servico-quantidade-${disciplina.id}`} label="Quantidade planejada">
              <Input
                id={`novo-servico-quantidade-${disciplina.id}`}
                value={novoServicoQuantidade}
                onChange={(event) => setNovoServicoQuantidade(event.target.value)}
              />
            </FormField>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!novoServicoNome.trim() || !novoServicoUnidade || criarServico.isPending}
                onClick={() =>
                  criarServico.mutate(
                    {
                      disciplinaId: disciplina.id,
                      nome: novoServicoNome,
                      unidade: Number(novoServicoUnidade),
                      peso_percentual: novoServicoPeso || undefined,
                      quantidade_planejada: novoServicoQuantidade || undefined,
                    },
                    {
                      onSuccess: () => {
                        setNovoServicoNome('')
                        setNovoServicoPeso('')
                        setNovoServicoQuantidade('')
                      },
                      onError: () => toast({ title: 'Não foi possível adicionar o serviço.', variant: 'destructive' }),
                    },
                  )
                }
              >
                Adicionar serviço
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

interface EapServicoRowProps {
  projetoId: string
  servico: CatalogoServico
}

function EapServicoRow({ projetoId, servico }: EapServicoRowProps) {
  const [peso, setPeso] = useState(servico.peso_percentual ?? '')
  const [quantidadePlanejada, setQuantidadePlanejada] = useState(servico.quantidade_planejada ?? '')
  const [quantidadeExecutadaManual, setQuantidadeExecutadaManual] = useState(servico.quantidade_executada_manual)
  const [dataInicioPrevista, setDataInicioPrevista] = useState(servico.data_inicio_prevista ?? '')
  const [dataFimPrevista, setDataFimPrevista] = useState(servico.data_fim_prevista ?? '')
  const [lancamentosVisiveis, setLancamentosVisiveis] = useState(false)

  const atualizarServico = useAtualizarServico(projetoId)

  function salvar(
    campo:
      | 'peso_percentual'
      | 'quantidade_planejada'
      | 'quantidade_executada_manual'
      | 'data_inicio_prevista'
      | 'data_fim_prevista',
    valor: string | null,
    valorOriginal: string | null,
  ) {
    if (valor === valorOriginal) return
    atualizarServico.mutate(
      { servicoId: servico.id, [campo]: valor },
      { onError: () => toast({ title: 'Não foi possível atualizar o serviço.', variant: 'destructive' }) },
    )
  }

  const somaRdo = (Number(servico.quantidade_executada) - Number(servico.quantidade_executada_manual)).toFixed(3)

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1 font-medium text-ink">{servico.nome}</span>
        <div className="flex w-32 items-center gap-2">
          <Progress
            value={servico.avanco_percentual ? Number(servico.avanco_percentual) : 0}
            indicatorClassName={execucaoCorClasse(servico.avanco_percentual)}
          />
          <span className="w-10 text-right text-muted-foreground">{formatExecucao(servico.avanco_percentual)}</span>
        </div>
        <FormField id={`servico-peso-${servico.id}`} label="Peso (%)" className="mb-0 w-20">
          <Input
            id={`servico-peso-${servico.id}`}
            value={peso}
            onChange={(event) => setPeso(event.target.value)}
            onBlur={() => salvar('peso_percentual', peso, servico.peso_percentual ?? '')}
          />
        </FormField>
        <FormField id={`servico-planejada-${servico.id}`} label="Planejada" className="mb-0 w-24">
          <Input
            id={`servico-planejada-${servico.id}`}
            value={quantidadePlanejada}
            onChange={(event) => setQuantidadePlanejada(event.target.value)}
            onBlur={() => salvar('quantidade_planejada', quantidadePlanejada, servico.quantidade_planejada ?? '')}
          />
        </FormField>
        <FormField id={`servico-ajuste-${servico.id}`} label="Ajuste manual" className="mb-0 w-24">
          <Input
            id={`servico-ajuste-${servico.id}`}
            value={quantidadeExecutadaManual}
            onChange={(event) => setQuantidadeExecutadaManual(event.target.value)}
            onBlur={() =>
              salvar('quantidade_executada_manual', quantidadeExecutadaManual, servico.quantidade_executada_manual)
            }
          />
        </FormField>
        <FormField id={`servico-inicio-${servico.id}`} label="Início previsto" className="mb-0 w-40">
          <Input
            id={`servico-inicio-${servico.id}`}
            type="date"
            value={dataInicioPrevista}
            onChange={(event) => setDataInicioPrevista(event.target.value)}
            onBlur={() =>
              salvar(
                'data_inicio_prevista',
                dataInicioPrevista === '' ? null : dataInicioPrevista,
                servico.data_inicio_prevista,
              )
            }
          />
        </FormField>
        <FormField id={`servico-fim-${servico.id}`} label="Fim previsto" className="mb-0 w-40">
          <Input
            id={`servico-fim-${servico.id}`}
            type="date"
            value={dataFimPrevista}
            onChange={(event) => setDataFimPrevista(event.target.value)}
            onBlur={() =>
              salvar('data_fim_prevista', dataFimPrevista === '' ? null : dataFimPrevista, servico.data_fim_prevista)
            }
          />
        </FormField>
        {servico.status_eap !== null && (
          <span
            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${statusEapCorClasse(servico.status_eap)}`}
          >
            {statusEapLabel(servico.status_eap)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-1 text-muted-foreground">
        <span>
          Executado: <span className="font-semibold text-ink">{servico.quantidade_executada}</span> (RDO: {somaRdo}
          {' + ajuste manual: '}
          {servico.quantidade_executada_manual})
        </span>
        {servico.avanco_previsto_percentual !== null && <span>Previsto: {servico.avanco_previsto_percentual}%</span>}
        {servico.producoes_vinculadas.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setLancamentosVisiveis((valor) => !valor)}>
            {lancamentosVisiveis ? 'Ocultar lançamentos' : `Ver lançamentos (${servico.producoes_vinculadas.length})`}
          </Button>
        )}
      </div>
      {lancamentosVisiveis && (
        <>
          {servico.carta_controle && <CartaControleChart cartaControle={servico.carta_controle} />}
          <ul className="flex flex-col gap-1 pl-1 text-muted-foreground">
            {servico.producoes_vinculadas.map((producao, indice) => (
              <li key={`${producao.data_referencia}-${producao.quantidade}-${indice}`}>
                {formatData(producao.data_referencia)} — {producao.quantidade}
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  )
}
```

- [ ] **Step 4: Rodar o typecheck**

```bash
cd frontend && npx tsc -b --noEmit
```
Esperado: apenas o erro pré-existente conhecido em `CustoCompositionDonutChart.tsx` (não relacionado a esta mudança). Nenhum erro novo.

- [ ] **Step 5: Achatar a árvore antes de desenhar o Gantt**

Em `frontend/src/features/configuracoes/GanttChart.tsx`, adicione a função `achatarDisciplinas` logo antes de `export function GanttChart` e troque a primeira linha do corpo da função:

```tsx
function achatarDisciplinas(disciplinas: Disciplina[]): Disciplina[] {
  return disciplinas.flatMap((disciplina) => [disciplina, ...achatarDisciplinas(disciplina.subdisciplinas)])
}

export function GanttChart({ disciplinas }: GanttChartProps) {
  const linhas = achatarDisciplinas(disciplinas)
    .filter((d) => d.data_inicio_prevista !== null && d.data_fim_prevista !== null)
    .map((d) => ({
      nome: d.nome,
      inicio: parseDataLocal(d.data_inicio_prevista as string).getTime(),
      // data_fim_prevista e inclusiva (o servico ainda esta em andamento durante
      // o proprio dia final) — soma 1 dia pra virar um instante exclusivo, senao
      // o ultimo dia do cronograma tem duracao zero e a linha "Hoje" some nele.
      fim: parseDataLocal(d.data_fim_prevista as string).getTime() + MS_POR_DIA,
      avancoReal: d.avanco_percentual ? Number(d.avanco_percentual) : null,
      cor: corDaBarra(d.status_eap),
    }))
```

O resto da função (a partir de `if (linhas.length === 0) return null`) não muda.

- [ ] **Step 6: Rodar o typecheck de novo**

```bash
cd frontend && npx tsc -b --noEmit
```
Esperado: mesmo resultado do Step 4 (só o erro pré-existente).

- [ ] **Step 7: Atualizar os fixtures existentes do e2e para incluir `subdisciplinas: []`**

Em `frontend/tests/e2e/config.spec.ts`, todo objeto de disciplina mockado precisa do campo `subdisciplinas: []` ao lado de `servicos` (senão `disciplina.subdisciplinas.map(...)` quebra em runtime, já que o componente agora acessa esse campo incondicionalmente). Há exatamente 13 pontos no arquivo, um por ocorrência de `servicos:`. Aplique a mesma transformação em cada um — adicionar `subdisciplinas: [],` imediatamente antes da chave `servicos`. Dois exemplos completos (um de linha única, um multi-linha) para deixar o padrão inequívoco:

Exemplo 1 (linha única, ocorre nas linhas 59, 73 e 108 do arquivo antes desta tarefa):
```typescript
// antes
{ id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, servicos: [] }
// depois
{ id: 'disc-1', nome: 'Terraplenagem', peso_percentual: null, avanco_percentual: null, subdisciplinas: [], servicos: [] }
```

Exemplo 2 (multi-linha, ocorre nas linhas 280, 330, 395, 446, 523, 575 e 662):
```typescript
// antes
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            servicos: [
// depois
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: '25.00',
            subdisciplinas: [],
            servicos: [
```

Aplique a mesma transformação (adicionar `subdisciplinas: [],` logo antes de `servicos:`) nas linhas restantes: 186 (dentro do objeto `disciplina` construído com `const disciplina = {...}`), 225 (dentro da resposta mockada do PATCH), e 628 (disciplina sem serviços, no teste do Gantt). Ao final, confirme com:

```bash
grep -c "subdisciplinas:" frontend/tests/e2e/config.spec.ts
```
Esperado: `13` (uma ocorrência de `subdisciplinas:` para cada uma das 13 ocorrências de `servicos:` já existentes, mais as que forem adicionadas nos novos testes do Step 8).

- [ ] **Step 8: Escrever os novos testes e2e (criar subdisciplina, aviso de peso misto, Gantt achatado)**

Em `frontend/tests/e2e/config.spec.ts`, adicione ao final do arquivo:

```typescript
test('cria subdisciplina e ela aparece aninhada dentro do card do pai', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  let subdisciplinaCriada = false

  await page.route(CONFIG_URL, (route) => {
    const disciplina = {
      id: 'disc-1',
      nome: 'Terraplenagem',
      peso_percentual: '100.00',
      avanco_percentual: null,
      servicos: [],
      subdisciplinas: subdisciplinaCriada
        ? [
            {
              id: 'disc-2',
              nome: 'Movimento de Terra',
              peso_percentual: null,
              avanco_percentual: null,
              servicos: [],
              subdisciplinas: [],
            },
          ]
        : [],
    }
    return route.fulfill({
      json: { disciplinas: [disciplina], equipes: [], valores_custo: [], soma_pesos_disciplinas: 100 },
    })
  })

  await page.route(DISCIPLINAS_URL, (route) => {
    subdisciplinaCriada = true
    return route.fulfill({
      status: 201,
      json: {
        id: 'disc-2',
        nome: 'Movimento de Terra',
        peso_percentual: null,
        avanco_percentual: null,
        servicos: [],
        subdisciplinas: [],
      },
    })
  })

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await page.getByLabel('Nova subdisciplina').fill('Movimento de Terra')
  await page.getByRole('button', { name: '+ Subdisciplina' }).click()

  await expect(page.getByText('Movimento de Terra')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expandir Movimento de Terra' })).toBeVisible()
})

test('aviso de soma de pesos considera subdisciplinas e servicos juntos', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            servicos: [
              {
                id: 'serv-1',
                nome: 'Corte',
                unidade: 1,
                peso_percentual: '30.00',
                quantidade_planejada: null,
                quantidade_executada: '0.000',
                quantidade_executada_manual: '0.000',
                producoes_vinculadas: [],
                carta_controle: null,
                avanco_percentual: null,
              },
            ],
            subdisciplinas: [
              {
                id: 'disc-2',
                nome: 'Movimento de Terra',
                peso_percentual: '30.00',
                avanco_percentual: null,
                servicos: [],
                subdisciplinas: [],
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Expandir Terraplenagem' }).click()

  await expect(page.getByText(/a soma dos pesos dos filhos desta disciplina não fecha 100%/)).toBeVisible()
})

test('Gantt mostra uma barra para disciplina raiz e outra para a subdisciplina', async ({ page }) => {
  await page.route(SESSION_URL, (route) =>
    route.fulfill({ json: { status: 200, data: { user: USUARIO }, meta: { is_authenticated: true } } }),
  )

  await page.route(CONFIG_URL, (route) =>
    route.fulfill({
      json: {
        disciplinas: [
          {
            id: 'disc-1',
            nome: 'Terraplenagem',
            peso_percentual: '100.00',
            avanco_percentual: null,
            avanco_previsto_percentual: null,
            status_eap: null,
            data_inicio_prevista: '2026-01-01',
            data_fim_prevista: '2026-03-01',
            servicos: [],
            subdisciplinas: [
              {
                id: 'disc-2',
                nome: 'Movimento de Terra',
                peso_percentual: '100.00',
                avanco_percentual: '50.00',
                avanco_previsto_percentual: '60.00',
                status_eap: 'atencao',
                data_inicio_prevista: '2026-01-01',
                data_fim_prevista: '2026-03-01',
                subdisciplinas: [],
                servicos: [
                  {
                    id: 'serv-1',
                    nome: 'Corte',
                    unidade: 1,
                    peso_percentual: '100.00',
                    quantidade_planejada: '1000.000',
                    quantidade_executada_manual: '500.000',
                    quantidade_executada: '500.000',
                    producoes_vinculadas: [],
                    carta_controle: null,
                    avanco_percentual: '50.00',
                    data_inicio_prevista: '2026-01-01',
                    data_fim_prevista: '2026-03-01',
                    avanco_previsto_percentual: '60.00',
                    status_eap: 'atencao',
                  },
                ],
              },
            ],
          },
        ],
        equipes: [],
        valores_custo: [],
        soma_pesos_disciplinas: 100,
      },
    }),
  )

  await page.goto('/projetos/projeto-1/configuracoes')
  await page.getByRole('tab', { name: 'EAP' }).click()
  await page.getByRole('button', { name: 'Ver cronograma (Gantt)' }).click()

  const grafico = page.getByLabel('Cronograma da EAP')
  await expect(grafico).toBeVisible()
  await expect(grafico.getByText('Terraplenagem')).toBeVisible()
  await expect(grafico.getByText('Movimento de Terra')).toBeVisible()
})
```

- [ ] **Step 9: Rodar a suíte e2e inteira e confirmar que passa**

```bash
cd frontend && npx playwright test tests/e2e/config.spec.ts
```
Esperado: `15 passed` (os 12 já existentes + os 3 novos).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/types/configuracao.ts \
        frontend/src/features/configuracoes/configuracaoApi.ts \
        frontend/src/features/configuracoes/EapDisciplinaCard.tsx \
        frontend/src/features/configuracoes/GanttChart.tsx \
        frontend/tests/e2e/config.spec.ts
git commit -m "feat: renderiza subdisciplinas em cartoes aninhados e achata a arvore no Gantt"
```
