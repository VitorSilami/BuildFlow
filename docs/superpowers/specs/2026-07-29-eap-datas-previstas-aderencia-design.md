# EAP — Datas Previstas e Aderência

## Contexto

Esta é a segunda peça do backlog "EAP completa" a ser implementada (a primeira foi a carta de
controle, `docs/superpowers/specs/2026-07-29-eap-carta-controle-design.md`). As demais — Gantt,
hierarquia N-níveis, importação CSV — ficam para specs futuras, cada uma seu próprio ciclo
spec/plano/implementação.

Esta peça é pré-requisito do Gantt: sem datas previstas por serviço não há como desenhar barras de
cronograma nem calcular aderência (avanço real vs. avanço previsto).

O protótipo de referência (`EPR_Daily_Completo.html`, funções `eapPrevisto`/`eapStatus`, linhas
1849-1873) tem cada item da EAP com `data_inicio_prevista`/`data_fim_prevista`, calcula o avanço
previsto por interpolação linear entre essas datas e a data de hoje, e classifica um status
(Não iniciado / No prazo / Atenção / Crítico / Concluído / Planejado) comparando avanço previsto com
avanço real. Esta spec implementa a mesma lógica sobre dados reais do sistema (`CatalogoServico`,
`calcular_avanco_servico` já existente), sem nenhuma alteração de escopo em relação ao protótipo.

## Escopo desta rodada

- Dois novos campos em `CatalogoServico`: `data_inicio_prevista` e `data_fim_prevista` (nuláveis).
- Cálculo de avanço previsto por interpolação linear (serviço) e rollup ponderado por peso
  (disciplina) — mesmo padrão já usado para avanço real.
- Classificação de status (`StatusEapChoices`) comparando avanço real com avanço previsto, mesmos
  limiares do protótipo.
- Exibição na aba EAP: campos de data editáveis, badge de status, avanço previsto ao lado do avanço
  realizado.

## Fora de escopo (backlog para specs futuras)

- Gantt/cronograma visual (consome os dados desta peça, mas é uma spec própria).
- Hierarquia N-níveis, importação/exportação CSV.
- Datas próprias de Disciplina — a janela da disciplina é sempre derivada dos serviços filhos (menor
  início, maior fim), nunca um dado digitado diretamente nela.
- Qualquer alerta/notificação proativa por status crítico (só exibição visual, sem sistema de
  alertas — mesma decisão já tomada na carta de controle).

## Modelo de dados (`buildflow/configuracoes/models.py`)

`CatalogoServico` ganha:

```python
data_inicio_prevista = models.DateField(_("data de início prevista"), null=True, blank=True)
data_fim_prevista = models.DateField(_("data de fim prevista"), null=True, blank=True)
```

Nuláveis, sem default — serviço legado (carga histórica) ou ainda não planejado continua funcionando
normalmente, só não participa do cálculo de avanço previsto (retorna `None`, nunca um número
inventado). Migração: `AddField` simples para os dois campos.

`Disciplina` não ganha nenhum campo de data.

## Cálculo (`buildflow/projetos/services.py`)

```python
class StatusEapChoices(models.TextChoices):
    CONCLUIDO = "concluido", _("Concluído")
    NO_PRAZO = "no_prazo", _("No prazo")
    ATENCAO = "atencao", _("Atenção")
    CRITICO = "critico", _("Crítico")
    NAO_INICIADO = "nao_iniciado", _("Não iniciado")
    PLANEJADO = "planejado", _("Planejado")


LIMIAR_CONCLUIDO = Decimal("99.95")
LIMIAR_NAO_INICIADO = Decimal("0.01")
DESVIO_CRITICO = Decimal("-8")
DESVIO_ATENCAO = Decimal("-3")


def calcular_avanco_previsto_servico(
    servico: CatalogoServico,
    hoje: datetime.date | None = None,
) -> Decimal | None:
    """Avanco previsto de um servico por interpolacao linear entre
    data_inicio_prevista e data_fim_prevista ate hoje. Sem as duas datas
    definidas, retorna None — nao ha base pra prever nada.
    """
    if servico.data_inicio_prevista is None or servico.data_fim_prevista is None:
        return None
    hoje = hoje or timezone.now().date()
    inicio, fim = servico.data_inicio_prevista, servico.data_fim_prevista
    if hoje <= inicio:
        return Decimal("0")
    if hoje >= fim:
        return Decimal("100")
    dias_totais = (fim - inicio).days
    dias_decorridos = (hoje - inicio).days
    return (Decimal(dias_decorridos) / Decimal(dias_totais) * Decimal("100")).quantize(Decimal("0.01"))


def calcular_avanco_previsto_disciplina(
    disciplina: Disciplina,
    hoje: datetime.date | None = None,
) -> Decimal | None:
    """Media ponderada (por peso_percentual) do avanco previsto dos servicos
    da disciplina. Servico sem peso ou sem previsto (datas ausentes) nao conta.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")
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


def classificar_status_eap(real: Decimal | None, previsto: Decimal | None) -> str | None:
    """Status do item (servico ou disciplina) a partir do avanco real vs
    previsto. Sem avanco real (sem quantidade_planejada), nao ha o que
    classificar — retorna None.
    """
    if real is None:
        return None
    if real >= LIMIAR_CONCLUIDO:
        return StatusEapChoices.CONCLUIDO
    if previsto is None:
        return StatusEapChoices.PLANEJADO
    if previsto <= LIMIAR_NAO_INICIADO and real <= LIMIAR_NAO_INICIADO:
        return StatusEapChoices.NAO_INICIADO
    desvio = real - previsto
    if desvio <= DESVIO_CRITICO:
        return StatusEapChoices.CRITICO
    if desvio <= DESVIO_ATENCAO:
        return StatusEapChoices.ATENCAO
    return StatusEapChoices.NO_PRAZO
```

`StatusEapChoices` fica em `services.py`, não em `models.py` — não é um campo persistido no banco,
é um enum de resultado calculado (mesmo espírito de `avanco_percentual`: nunca armazenado, sempre
recalculado).

## API (`buildflow/configuracoes/serializers.py`)

`CatalogoServicoSerializer` ganha os dois campos de data como campos de modelo graváveis (mesmo
padrão de `peso_percentual`/`quantidade_planejada`, não são `SerializerMethodField`), mais dois
campos computados:

```python
data_inicio_prevista = serializers.DateField(required=False, allow_null=True)
data_fim_prevista = serializers.DateField(required=False, allow_null=True)
avanco_previsto_percentual = serializers.SerializerMethodField()
status_eap = serializers.SerializerMethodField()

def get_avanco_previsto_percentual(self, obj: CatalogoServico) -> str | None:
    return decimal_para_str_ou_none(calcular_avanco_previsto_servico(obj))

def get_status_eap(self, obj: CatalogoServico) -> str | None:
    return classificar_status_eap(calcular_avanco_servico(obj), calcular_avanco_previsto_servico(obj))

def validate(self, attrs):
    inicio = attrs.get("data_inicio_prevista", getattr(self.instance, "data_inicio_prevista", None))
    fim = attrs.get("data_fim_prevista", getattr(self.instance, "data_fim_prevista", None))
    if inicio and fim and fim < inicio:
        raise serializers.ValidationError(
            {"data_fim_prevista": "Data de fim prevista não pode ser anterior à data de início prevista."},
        )
    return attrs
```

`DisciplinaSerializer` ganha os mesmos dois campos computados (`avanco_previsto_percentual`,
`status_eap`), calculados a partir de `calcular_avanco_previsto_disciplina`/`calcular_avanco_disciplina`
— sem campos de data próprios, como decidido acima.

`CatalogoServicoResumoSerializer`/`DisciplinaResumoSerializer` (bootstrap do RDO) não ganham nenhum
desses 4 campos — mesma exclusão já aplicada a `avanco_percentual`/`carta_controle`.

## Frontend

- `types/configuracao.ts`: novo tipo `StatusEap` (união das 6 strings: `'concluido' | 'no_prazo' |
  'atencao' | 'critico' | 'nao_iniciado' | 'planejado'`); `CatalogoServico` ganha
  `data_inicio_prevista: string | null`, `data_fim_prevista: string | null`,
  `avanco_previsto_percentual: string | null`, `status_eap: StatusEap | null`; `Disciplina` ganha
  `avanco_previsto_percentual` e `status_eap`.
- `lib/format.ts`: novas funções `statusEapLabel(status: StatusEap | null)` e
  `statusEapCorClasse(status: StatusEap | null)` (mesmo padrão de `execucaoCorClasse`) — mapeamento
  para rótulo/cor em português: Concluído/No prazo → verde, Atenção → âmbar, Crítico → vermelho,
  Não iniciado → cinza, Planejado → azul.
- `EapDisciplinaCard.tsx`:
  - Dois novos `FormField`+`Input type="date"` (Início previsto / Fim previsto) na linha do serviço,
    ao lado do ajuste manual, salvando via `useAtualizarServico` no `onBlur` (mesmo padrão dos demais
    campos).
  - Badge de status (pill colorido com `statusEapCorClasse`/`statusEapLabel`) ao lado da barra de
    progresso, tanto na linha do serviço quanto no cabeçalho da disciplina — só renderiza quando
    `status_eap !== null`.
  - Texto "Previsto: X%" ao lado do "Executado: Y%" quando `avanco_previsto_percentual !== null`.
- `configuracaoApi.ts`: payload de `useAtualizarServico` ganha `data_inicio_prevista?`/
  `data_fim_prevista?`.

## Testes

- `buildflow/projetos/tests/test_execucao.py`:
  - `calcular_avanco_previsto_servico`: sem datas → `None`; hoje antes do início → `0`; hoje depois
    do fim → `100`; hoje no meio com valores conhecidos (ex. 30 de 100 dias → `30.00`).
  - `calcular_avanco_previsto_disciplina`: rollup ponderado com um serviço sem data (excluído) e
    outro com data.
  - `classificar_status_eap`: casos exatos nos limiares (desvio `-8.00` → Crítico, `-7.99` →
    Atenção, `-3.00` → Atenção, `-2.99` → No prazo); `real=100` → Concluído mesmo com previsto baixo;
    `previsto=None` → Planejado; `real` e `previsto` ambos `~0` → Não iniciado; `real=None` → `None`.
- `buildflow/configuracoes/tests/test_api.py`:
  - Serializer expõe os 4 campos novos no serviço e nos 2 campos computados na disciplina.
  - `PATCH` grava `data_inicio_prevista`/`data_fim_prevista`.
  - `data_fim_prevista` anterior a `data_inicio_prevista` retorna 400.
  - `CatalogoServicoResumoSerializer`/`DisciplinaResumoSerializer` (endpoint de configuração-rdo) não
    expõem nenhum dos 4 campos.
- `frontend/tests/e2e/config.spec.ts`:
  - Mock com datas e status preenchidos mostra badge de status e "Previsto: X%".
  - Mock sem datas não mostra nada extra (comportamento atual preservado).
  - Inputs de data salvam via PATCH (mesmo padrão dos testes de peso/quantidade já existentes).
