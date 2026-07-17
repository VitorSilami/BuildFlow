from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

MAX_FOTO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
TIPOS_FOTO_PERMITIDOS = {"image/jpeg", "image/png", "image/webp"}


def validar_apontamento_maquina(
    *,
    maquina,
    identificacao_avulsa,
    horas_paradas,
    motivo_parada,
) -> None:
    if not maquina and not identificacao_avulsa:
        msg = _("Informe uma máquina cadastrada ou uma identificação avulsa.")
        raise ValidationError(msg)
    if maquina and identificacao_avulsa:
        msg = _("Escolha apenas uma opção: máquina cadastrada OU identificação avulsa.")
        raise ValidationError(msg)
    if horas_paradas and horas_paradas > 0 and not motivo_parada:
        msg = _("Motivo da parada é obrigatório quando há horas paradas.")
        raise ValidationError(msg)


def validar_presenca(*, pessoa, nome_avulso) -> None:
    if not pessoa and not nome_avulso:
        msg = _("Informe uma pessoa cadastrada ou um nome avulso.")
        raise ValidationError(msg)
    if pessoa and nome_avulso:
        msg = _("Escolha apenas uma opção: pessoa cadastrada OU nome avulso.")
        raise ValidationError(msg)


def validar_arquivo_foto(arquivo) -> None:
    if arquivo.size > MAX_FOTO_SIZE_BYTES:
        msg = _("A foto excede o tamanho máximo permitido (10 MB).")
        raise ValidationError(msg)
    content_type = getattr(arquivo, "content_type", None)
    if content_type and content_type not in TIPOS_FOTO_PERMITIDOS:
        msg = _("Formato de imagem não suportado. Use JPEG, PNG ou WebP.")
        raise ValidationError(msg)
