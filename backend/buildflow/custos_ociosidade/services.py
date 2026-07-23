from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from buildflow.configuracoes.models import ValorCusto
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
from buildflow.registros_diarios.models import StatusPresencaChoices

if TYPE_CHECKING:
    from buildflow.projetos.models import Projeto

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
    valores = ValorCusto.objects.filter(projeto=projeto, tipo="mao_de_obra").exclude(
        funcao="",
    )
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
            {
                "funcao": presenca.funcao,
                "dias_trabalhados": 0,
                "faltas": 0,
                "atestados": 0,
            },
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
        custo = (
            dados["dias_trabalhados"] * diaria if diaria is not None else Decimal("0")
        )
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


def _montar_payload_maquinas(
    agrupado: dict[str, dict],
    valores_hora: dict[str, Decimal],
):
    custo_produtivo_total = Decimal("0")
    custo_ocioso_total = Decimal("0")
    payload = []
    for maquina_id, dados in agrupado.items():
        valor_hora = valores_hora.get(maquina_id)
        custo_produtivo = (
            (dados["horas_produtivas"] * valor_hora).quantize(Decimal("0.01"))
            if valor_hora is not None
            else Decimal("0")
        )
        custo_ocioso = (
            (dados["horas_paradas"] * valor_hora).quantize(Decimal("0.01"))
            if valor_hora is not None
            else Decimal("0")
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
                "custo_ocioso": custo_ocioso,  # decimal ate o sort abaixo
                "eficiencia_percentual": _calcular_eficiencia_percentual(
                    dados["horas_produtivas"],
                    dados["horas_paradas"],
                ),
                "tem_valor_cadastrado": valor_hora is not None,
            },
        )
    # Maior custo parado primeiro — quem esta custando mais ocioso e o que
    # mais merece atencao, nao a ordem alfabetica do codigo do equipamento.
    payload.sort(key=lambda item: item["custo_ocioso"], reverse=True)
    for item in payload:
        item["custo_ocioso"] = decimal_para_str_ou_none(item["custo_ocioso"])
    return custo_produtivo_total, custo_ocioso_total, payload


def _montar_payload_faltas_por_pessoa(presencas, diarias: dict[str, Decimal]):
    # Presencas avulsas (sem pessoa cadastrada) tambem contam faltas — agrupadas
    # pelo nome digitado, ja que e a unica identidade estavel disponivel pra
    # elas. Excluir essas linhas fazia reforcos com faltas reais sumirem desta
    # lista (bug real reportado: 3 pessoas marcadas com falta, so 1 aparecia).
    agrupado: dict[str, dict] = {}
    for presenca in presencas:
        if presenca.pessoa_id:
            chave = f"pessoa:{presenca.pessoa_id}"
            pessoa_id = str(presenca.pessoa_id)
            nome = presenca.pessoa.nome
        else:
            nome = presenca.nome_avulso.strip()
            chave = f"avulso:{nome.lower()}"
            pessoa_id = None
        registro = agrupado.setdefault(
            chave,
            {
                "pessoa_id": pessoa_id,
                "nome": nome,
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
                "valor_perdido": valor_perdido,  # decimal ate o sort abaixo
                "tem_valor_cadastrado": diaria is not None,
                "reincidente": dados["faltas"] >= FALTAS_REINCIDENCIA_MINIMA,
            },
        )
    # Maior valor perdido primeiro — impacto financeiro, nao so contagem de
    # faltas, e o que decide quem mais merece atencao.
    payload.sort(key=lambda item: item["valor_perdido"], reverse=True)
    for item in payload:
        item["valor_perdido"] = decimal_para_str_ou_none(item["valor_perdido"])
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
    custo_mao_de_obra, deficit_mao_de_obra, mao_de_obra_payload = (
        _montar_payload_mao_de_obra(
            agrupado_mao_de_obra,
            diarias,
        )
    )

    (
        agrupado_maquinas,
        horas_por_causa,
        horas_produtivas_total,
        horas_paradas_total,
    ) = _agrupar_maquinas(apontamentos)
    custo_produtivo_maquinas, custo_ocioso_maquinas, maquinas_payload = (
        _montar_payload_maquinas(
            agrupado_maquinas,
            valores_hora,
        )
    )

    return {
        "mes": f"{ano:04d}-{mes:02d}",
        "custo_mao_de_obra": decimal_para_str_ou_none(custo_mao_de_obra),
        "deficit_mao_de_obra": decimal_para_str_ou_none(deficit_mao_de_obra),
        "custo_produtivo_maquinas": decimal_para_str_ou_none(custo_produtivo_maquinas),
        "custo_ocioso_maquinas": decimal_para_str_ou_none(custo_ocioso_maquinas),
        "custo_total": decimal_para_str_ou_none(
            custo_mao_de_obra + custo_produtivo_maquinas,
        ),
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
