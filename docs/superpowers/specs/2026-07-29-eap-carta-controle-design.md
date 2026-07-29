# EAP — Carta de Controle de Produtividade Diária

## Contexto

Esta é a primeira peça do backlog "EAP completa" (as demais — datas planejadas/aderência, Gantt,
hierarquia N-níveis, importação CSV — ficam para specs futuras, cada uma seu próprio ciclo
spec/plano/implementação, mesmo padrão já usado nas duas fatias anteriores da EAP).

O protótipo de referência (`EPR_Daily_Completo.html`, funções `eapCartaControle`/`drawCartaControle`,
linhas 4331-4369) tem uma "carta de controle" por item da EAP — um gráfico de controle estatístico
(SPC) de produtividade diária, com média, desvio padrão e limites de controle (LSC/LIC = média ± 3σ).

**Descoberta importante:** no protótipo, essa carta é inteiramente decorativa/fake — a média é um
número mágico hardcoded ou `quantidade_planejada / 30`, o desvio é `média × 0.17` (coeficiente
inventado), e os "20 pontos" do gráfico vêm de uma função seno com seed baseada no código do item,
sem nenhuma relação com produção real. Isso contraria o princípio "nunca inventa número" que guia o
resto do sistema. Esta spec implementa a versão real: estatística calculada a partir da produção
diária efetivamente lançada e aprovada nos RDOs (`ProducaoDiaria`, já vinculada a `CatalogoServico`
desde a spec de integração RDO→EAP).

## Escopo desta rodada

- Cálculo real de média, desvio padrão amostral e limites de controle (LSC/LIC) a partir da soma
  diária de `ProducaoDiaria` aprovada por serviço.
- Amostra mínima de **5 dias distintos** de produção aprovada para calcular estatística. Abaixo
  disso, nenhuma estatística é exibida — decisão consciente do usuário: média/desvio com amostra
  muito pequena é estatisticamente sem sentido (ex.: 1 ponto único geraria desvio zero).
- Exibição do gráfico dentro do toggle "Ver lançamentos" já existente na aba EAP (não cria um painel
  de detalhe separado).

## Fora de escopo (backlog para specs futuras)

- Datas planejadas, avanço previsto, aderência e "painel diretor" (dependem de datas de
  início/fim planejadas, que não existem ainda no modelo — spec futura própria).
- Gantt/cronograma visual.
- Hierarquia N-níveis, importação/exportação CSV.
- Qualquer alerta/notificação proativa quando um ponto fica fora de controle (só exibição visual no
  gráfico, sem sistema de alertas).

## Cálculo (`buildflow/projetos/services.py`)

Nova função:

```python
from dataclasses import dataclass
from statistics import stdev


AMOSTRA_MINIMA_CARTA_CONTROLE = 5


@dataclass
class PontoCartaControle:
    data_referencia: datetime.date
    quantidade: Decimal
    fora_de_controle: bool


@dataclass
class CartaControle:
    media: Decimal
    desvio_padrao: Decimal
    lsc: Decimal
    lic: Decimal
    pontos: list[PontoCartaControle]


def calcular_carta_controle(servico: CatalogoServico) -> CartaControle | None:
    """Carta de controle (SPC) da produtividade diaria de um servico: soma as
    ProducaoDiaria aprovadas por dia (um RDO pode ter mais de um lancamento do
    mesmo servico no mesmo dia), calcula media/desvio padrao amostral e limites
    de controle (LSC/LIC = media +/- 3 desvios) a partir dos totais diarios
    reais. Com menos de AMOSTRA_MINIMA_CARTA_CONTROLE dias distintos, retorna
    None — nunca inventa estatistica com amostra pequena demais.
    """
    totais_por_dia = (
        ProducaoDiaria.objects.filter(
            servico=servico,
            registro_diario__status=StatusRegistroChoices.APROVADO,
        )
        .values("registro_diario__data_referencia")
        .annotate(total=Sum("quantidade"))
        .order_by("registro_diario__data_referencia")
    )

    if len(totais_por_dia) < AMOSTRA_MINIMA_CARTA_CONTROLE:
        return None

    valores = [linha["total"] for linha in totais_por_dia]
    media = (sum(valores) / len(valores)).quantize(Decimal("0.001"))
    desvio = stdev(valores).quantize(Decimal("0.001"))
    lsc = media + 3 * desvio
    lic = max(Decimal("0"), media - 3 * desvio)

    pontos = [
        PontoCartaControle(
            data_referencia=linha["registro_diario__data_referencia"],
            quantidade=linha["total"],
            fora_de_controle=linha["total"] > lsc or linha["total"] < lic,
        )
        for linha in totais_por_dia
    ]

    return CartaControle(media=media, desvio_padrao=desvio, lsc=lsc, lic=lic, pontos=pontos)
```

`stdev` (desvio padrão amostral, divisor N-1) vem da biblioteca padrão `statistics` — mesmo cálculo
estatístico usado em qualquer carta de controle real, sem inventar coeficiente.

## API (`buildflow/configuracoes/serializers.py`)

`CatalogoServicoSerializer` ganha um novo campo computado:

```python
carta_controle = serializers.SerializerMethodField()

def get_carta_controle(self, obj: CatalogoServico) -> dict | None:
    cc = calcular_carta_controle(obj)
    if cc is None:
        return None
    return {
        "media": str(cc.media),
        "desvio_padrao": str(cc.desvio_padrao),
        "lsc": str(cc.lsc),
        "lic": str(cc.lic),
        "pontos": [
            {
                "data_referencia": p.data_referencia.isoformat(),
                "quantidade": str(p.quantidade),
                "fora_de_controle": p.fora_de_controle,
            }
            for p in cc.pontos
        ],
    }
```

Diferente de `producoes_vinculadas` (mais-recente-primeiro, pensado pra leitura de lista),
`carta_controle.pontos` vem em ordem cronológica crescente — leitura de gráfico de linha é do mais
antigo pro mais recente, da esquerda pra direita.

`CatalogoServicoResumoSerializer` (usado só no bootstrap do RDO) não ganha esse campo — mesma lógica
já aplicada a `avanco_percentual`/`quantidade_executada`/`producoes_vinculadas`.

## Frontend

- `types/configuracao.ts`: novo tipo `PontoCartaControle` (`data_referencia`, `quantidade`,
  `fora_de_controle`) e `CartaControle` (`media`, `desvio_padrao`, `lsc`, `lic`,
  `pontos: PontoCartaControle[]`); `CatalogoServico` ganha `carta_controle: CartaControle | null`.
- `EapDisciplinaCard.tsx` (`EapServicoRow`): dentro do bloco já existente que abre com "Ver
  lançamentos", quando `servico.carta_controle !== null`, renderiza um `LineChart` do Recharts (já é
  dependência do projeto — `recharts` em `frontend/package.json`) **acima** da lista de lançamentos:
  - Linha da produção diária (`pontos`, eixo X = data formatada via `formatData`, eixo Y =
    quantidade).
  - Três `ReferenceLine` horizontais: média (linha sólida), LSC e LIC (linhas tracejadas).
  - Pontos com `fora_de_controle: true` destacados em vermelho (cor de alerta já usada no projeto,
    ex. a mesma de `execucaoCorClasse` para valores baixos).
- Quando `carta_controle` é `null` (menos de 5 dias): nenhuma mudança — continua mostrando só a
  lista de lançamentos como hoje, sem aviso adicional. A ausência do gráfico já comunica "dado
  insuficiente" sem precisar de texto explícito.

## Testes

- `buildflow/projetos/tests/test_execucao.py`: `calcular_carta_controle` — menos de 5 dias distintos
  retorna `None`; exatamente 5 dias calcula média/desvio/LSC/LIC corretos (valores conhecidos,
  verificáveis à mão); dois lançamentos no mesmo dia somam antes de entrar na amostra; um ponto acima
  do LSC e outro abaixo do LIC são marcados `fora_de_controle=True`, os demais `False`.
- `buildflow/configuracoes/tests/test_api.py`: serializer expõe `carta_controle: null` com poucos
  dias; expõe o objeto completo com 5+ dias, `pontos` em ordem cronológica crescente (oposto de
  `producoes_vinculadas`); `CatalogoServicoResumoSerializer` (endpoint de configuração-rdo) não expõe
  `carta_controle`.
- Frontend: `tests/e2e/config.spec.ts` — mock com `carta_controle: null` continua mostrando só a
  lista (sem gráfico); mock com `carta_controle` preenchido mostra o gráfico (verificar um elemento
  do SVG do Recharts, ex. `.recharts-line`) e não quebra o toggle existente.
