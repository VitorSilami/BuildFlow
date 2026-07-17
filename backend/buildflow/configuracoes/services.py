from decimal import Decimal


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
