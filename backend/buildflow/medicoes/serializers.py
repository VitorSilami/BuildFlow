from decimal import Decimal

from rest_framework import serializers

from .models import ItemMedicao
from .models import Medicao


class ItemMedicaoSerializer(serializers.ModelSerializer):
    servico_nome = serializers.CharField(source="servico.nome", read_only=True)
    disciplina_nome = serializers.CharField(
        source="servico.disciplina.nome",
        read_only=True,
    )

    class Meta:
        model = ItemMedicao
        fields = [
            "id",
            "servico",
            "servico_nome",
            "disciplina_nome",
            "quantidade_anterior",
            "quantidade_acumulada",
            "quantidade_periodo",
            "preco_unitario_snapshot",
            "valor_periodo",
        ]
        read_only_fields = fields


class MedicaoSerializer(serializers.ModelSerializer):
    fiscal_nome = serializers.CharField(source="fiscal.nome", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.nome", read_only=True)
    itens = ItemMedicaoSerializer(many=True, read_only=True)
    valor_total = serializers.SerializerMethodField()
    quantidade_itens_sem_preco = serializers.SerializerMethodField()

    class Meta:
        model = Medicao
        fields = [
            "id",
            "data_corte",
            "fiscal",
            "fiscal_nome",
            "criado_por",
            "criado_por_nome",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
            "itens",
            "valor_total",
            "quantidade_itens_sem_preco",
        ]
        read_only_fields = [
            "id",
            "criado_por",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
        ]

    def get_valor_total(self, obj: Medicao) -> str:
        total = sum(
            (
                item.valor_periodo
                for item in obj.itens.all()
                if item.valor_periodo is not None
            ),
            Decimal("0"),
        )
        return str(total)

    def get_quantidade_itens_sem_preco(self, obj: Medicao) -> int:
        return sum(
            1 for item in obj.itens.all() if item.preco_unitario_snapshot is None
        )
