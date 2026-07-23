from __future__ import annotations

import datetime

from rest_framework.exceptions import ValidationError


def filtro_intervalo_datas(
    data_inicio: str | None,
    data_fim: str | None,
    campo: str,
) -> dict[str, datetime.date]:
    """Filtro Django {campo__gte, campo__lte} a partir de datas ISO
    (YYYY-MM-DD). Retorna {} se nenhuma data foi informada — 400 se so uma
    veio, formato invalido, ou data_fim anterior a data_inicio.
    """
    if not data_inicio and not data_fim:
        return {}
    if not (data_inicio and data_fim):
        raise ValidationError({"data_inicio": "Informe data_inicio e data_fim juntos."})
    try:
        inicio = datetime.date.fromisoformat(data_inicio)
        fim = datetime.date.fromisoformat(data_fim)
    except ValueError as erro:
        raise ValidationError({"data_inicio": "Use o formato YYYY-MM-DD."}) from erro
    if inicio > fim:
        raise ValidationError({"data_fim": "data_fim deve ser maior ou igual a data_inicio."})
    return {f"{campo}__gte": inicio, f"{campo}__lte": fim}
