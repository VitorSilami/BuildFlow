from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError


def soma_pesos_disciplinas(projeto) -> Decimal:
    """Soma dos pesos percentuais das disciplinas de um projeto.

    Validacao informativa (nao bloqueante): o frontend usa isso so para
    alertar visualmente quando a soma nao fica proxima de 100%, sem impedir
    o salvamento (H: a planilha de EAP do prototipo so validava
    visualmente, nunca travava o cadastro).
    """
    total = Decimal("0")
    for disciplina in projeto.disciplinas.all():
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
