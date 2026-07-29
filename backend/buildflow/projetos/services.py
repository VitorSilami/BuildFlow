from __future__ import annotations

import datetime
from dataclasses import dataclass
from decimal import Decimal
from statistics import stdev
from typing import TYPE_CHECKING

from django.db import models
from django.db.models import Count
from django.db.models import Sum
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.registros_diarios.models import StatusRegistroChoices

from .models import Projeto

if TYPE_CHECKING:
    from buildflow.configuracoes.models import CatalogoServico
    from buildflow.configuracoes.models import Disciplina
    from buildflow.empresas.models import Empresa

DIAS_JANELA_ATIVIDADE = 7
AMOSTRA_MINIMA_CARTA_CONTROLE = 5
LIMIAR_CONCLUIDO = Decimal("99.95")
LIMIAR_NAO_INICIADO = Decimal("0.01")
DESVIO_CRITICO = Decimal("-8")
DESVIO_ATENCAO = Decimal("-3")


class StatusEapChoices(models.TextChoices):
    CONCLUIDO = "concluido", _("Concluído")
    NO_PRAZO = "no_prazo", _("No prazo")
    ATENCAO = "atencao", _("Atenção")
    CRITICO = "critico", _("Crítico")
    NAO_INICIADO = "nao_iniciado", _("Não iniciado")
    PLANEJADO = "planejado", _("Planejado")


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

    return CartaControle(
        media=media, desvio_padrao=desvio, lsc=lsc, lic=lic, pontos=pontos,
    )


def calcular_quantidade_executada_total(servico: CatalogoServico) -> Decimal:
    """Quantidade executada de um servico: soma dos lancamentos de ProducaoDiaria
    de RDOs aprovados vinculados a ele, mais o ajuste manual (producao anterior
    ao uso do sistema ou correcoes pontuais). RDO rejeitado ou aguardando
    aprovacao nao conta — so producao formalmente aprovada e um numero real.
    Sempre recalculada, nunca armazenada.
    """
    soma_rdo = ProducaoDiaria.objects.filter(
        servico=servico,
        registro_diario__status=StatusRegistroChoices.APROVADO,
    ).aggregate(total=Sum("quantidade"))["total"] or Decimal("0")
    return servico.quantidade_executada_manual + soma_rdo


def listar_producoes_vinculadas(servico: CatalogoServico) -> list[ProducaoDiaria]:
    """Lancamentos de RDO aprovados vinculados a um servico, do mais recente
    para o mais antigo — usado para exibir rastreabilidade do total executado.
    RDO rejeitado ou aguardando aprovacao nao aparece aqui (mesma regra de
    calcular_quantidade_executada_total)."""
    return list(
        ProducaoDiaria.objects.filter(
            servico=servico,
            registro_diario__status=StatusRegistroChoices.APROVADO,
        )
        .select_related("registro_diario")
        .order_by("-registro_diario__data_referencia"),
    )


def calcular_avanco_servico(servico: CatalogoServico) -> Decimal | None:
    """Percentual executado de um servico: quantidade_executada / quantidade_planejada.
    Retorna None quando nao ha quantidade planejada — nunca inventa um numero.
    """
    if not servico.quantidade_planejada:
        return None
    quantidade_executada = calcular_quantidade_executada_total(servico)
    proporcao = quantidade_executada / servico.quantidade_planejada
    return (proporcao * Decimal("100")).quantize(Decimal("0.01"))


def calcular_avanco_disciplina(disciplina: Disciplina) -> Decimal | None:
    """Media ponderada (por CatalogoServico.peso_percentual) do avanco dos
    servicos de uma disciplina. Servico sem peso definido nao conta. Retorna
    None quando nenhum servico tem peso definido.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

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
    proporcao = Decimal(dias_decorridos) / Decimal(dias_totais) * Decimal("100")
    return proporcao.quantize(Decimal("0.01"))


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


def classificar_status_eap(  # noqa: PLR0911
    real: Decimal | None, previsto: Decimal | None,
) -> str | None:
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


def calcular_execucao_percentual(projeto: Projeto) -> Decimal | None:
    """Media ponderada (por Disciplina.peso_percentual) do avanco de cada
    disciplina do projeto. Disciplina sem peso definido nao conta. Retorna
    None quando nao ha base real para calcular (sem disciplinas, ou nenhuma
    disciplina com peso definido) — nunca inventa um numero.
    """
    soma_pesos = Decimal("0")
    soma_ponderada = Decimal("0")

    for disciplina in projeto.disciplinas.all():
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


def decimal_para_str_ou_none(valor: Decimal | None) -> str | None:
    return str(valor) if valor is not None else None


def obter_ultima_data_rdo(projeto: Projeto) -> datetime.date | None:
    """Data do RegistroDiario mais recente do projeto, ou None se nunca houve
    nenhum — mesma regra de nunca inventar dado: ausencia de RDO e ausencia
    de valor, nao uma data arbitraria.
    """
    ultimo = (
        RegistroDiario.objects.filter(projeto=projeto)
        .order_by("-data_referencia")
        .first()
    )
    return ultimo.data_referencia if ultimo is not None else None


def obter_atividade_rdo_semana(empresa: Empresa) -> list[dict[str, str | int]]:
    """Contagem de RegistroDiario por dia, ultimos 7 dias (hoje inclusive), dos
    projetos ativos da empresa. Dias sem nenhum RDO aparecem com quantidade 0
    explicito — o grafico de barras do frontend nao pode "pular" um dia sem
    dado, senao a leitura do eixo X fica errada.
    """
    hoje = timezone.now().date()
    inicio = hoje - datetime.timedelta(days=DIAS_JANELA_ATIVIDADE - 1)

    linhas = (
        RegistroDiario.objects.filter(
            projeto__empresa=empresa,
            projeto__status=Projeto.StatusChoices.ATIVO,
            data_referencia__gte=inicio,
            data_referencia__lte=hoje,
        )
        .values("data_referencia")
        .annotate(quantidade=Count("id"))
    )
    contagem_por_dia = {
        linha["data_referencia"]: linha["quantidade"] for linha in linhas
    }

    return [
        {
            "data": (inicio + datetime.timedelta(days=offset)).isoformat(),
            "quantidade": contagem_por_dia.get(
                inicio + datetime.timedelta(days=offset),
                0,
            ),
        }
        for offset in range(DIAS_JANELA_ATIVIDADE)
    ]
