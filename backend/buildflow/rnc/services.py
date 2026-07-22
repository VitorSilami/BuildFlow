from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from buildflow.rnc.models import RNC
from buildflow.rnc.models import AcaoCorretiva
from buildflow.rnc.models import CategoriaChoices
from buildflow.rnc.models import StatusRncChoices

CATEGORIA_ITENS = {
    CategoriaChoices.TERRAPLENAGEM: [
        "Serviços complementares",
        "Caminhos de serviço",
        "Cortes",
        "Empréstimos",
        "Aterros",
        "Limpeza",
        "Outros",
    ],
    CategoriaChoices.PAVIMENTACAO: [
        "Regularização do subleito",
        "Reforço do subleito",
        "Sub-base",
        "Base",
        "Imprimação",
        "Pintura de ligação",
        "Camada de ligação",
        "Reciclagem",
        "Outros",
    ],
    CategoriaChoices.CONTENCOES: [
        "Infraestrutura",
        "Mesoestrutura",
        "Superestrutura",
        "Encontros",
        "Acabamentos",
        "Outros",
    ],
    CategoriaChoices.OAES: [
        "Infraestrutura",
        "Mesoestrutura",
        "Superestrutura",
        "Encontros",
        "Outros",
    ],
    CategoriaChoices.OACS_E_DRENAGEM: [
        "Bueiros",
        "Drenos transversais",
        "Canaletas e valetas",
        "Descidas d'água e escadas",
        "Caixas coletoras",
        "Drenagens",
        "Outros",
    ],
    CategoriaChoices.SINALIZACAO_SEGURANCA: [
        "Sinalização vertical",
        "Sinalização horizontal",
        "Sinalização de obras",
        "Outros",
    ],
    CategoriaChoices.OUTROS: [
        "Insumos e materiais",
        "Instalações e equipamentos",
        "Execução",
        "Procedimento",
        "Manejo ambiental",
        "Segurança do trabalho",
        "Controle de qualidade",
        "Controle",
        "Outros",
    ],
}


def validar_item_da_categoria(*, categoria: str, item: str) -> None:
    itens_validos = CATEGORIA_ITENS.get(categoria, [])
    if item not in itens_validos:
        msg = _("Item inválido para a categoria selecionada.")
        raise ValidationError(msg)


def gerar_numero_sequencial(projeto) -> int:
    return RNC.objects.filter(projeto=projeto).count() + 1


def validar_rnc_editavel(rnc: RNC) -> None:
    if rnc.status == StatusRncChoices.CONCLUIDA:
        msg = _("Esta RNC já foi concluída e não pode mais ser editada.")
        raise ValidationError(msg)


def concluir_rnc(*, rnc: RNC, eficacia: str) -> RNC:
    if rnc.status == StatusRncChoices.CONCLUIDA:
        msg = _("Esta RNC já foi concluída.")
        raise ValidationError(msg)
    if not eficacia:
        msg = _("Informe a eficácia da ação (Eficaz ou Ineficaz) para concluir a RNC.")
        raise ValidationError(msg)

    rnc.status = StatusRncChoices.CONCLUIDA
    rnc.eficacia = eficacia
    rnc.data_conclusao = timezone.now()
    rnc.save(update_fields=["status", "eficacia", "data_conclusao", "updated_at"])
    return rnc


def adicionar_acao_corretiva(
    *,
    rnc: RNC,
    descricao: str,
    risco: str,
    data_limite,
    responsavel: str,
) -> AcaoCorretiva:
    validar_rnc_editavel(rnc)
    return AcaoCorretiva.objects.create(
        rnc=rnc,
        descricao=descricao,
        risco=risco,
        data_limite=data_limite,
        responsavel=responsavel,
    )


def calcular_status_efetivo(rnc: RNC) -> str:
    if rnc.status == StatusRncChoices.PENDENTE and rnc.data_prazo is not None:
        if rnc.data_prazo < timezone.now().date():
            return "prazo_excedido"
    return rnc.status
