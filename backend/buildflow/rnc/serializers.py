from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from buildflow.rnc import services
from buildflow.rnc.models import RNC
from buildflow.rnc.models import AcaoCorretiva


class AcaoCorretivaSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcaoCorretiva
        fields = ["id", "descricao", "risco", "data_limite", "responsavel"]
        read_only_fields = ["id"]


class RncSerializer(serializers.ModelSerializer):
    acoes_corretivas = AcaoCorretivaSerializer(many=True, required=False, default=[])
    status_efetivo = serializers.SerializerMethodField()

    class Meta:
        model = RNC
        fields = [
            "id",
            "projeto",
            "numero_sequencial",
            "data_emissao",
            "contratada",
            "categoria",
            "origem",
            "gravidade",
            "tipo",
            "item",
            "subitem",
            "norma",
            "requisito",
            "abrangencia",
            "km",
            "reincidencia",
            "descricao",
            "acao_imediata",
            "data_implementacao",
            "responsavel_implementacao",
            "causa_metodo",
            "causa_metodo_detalhe",
            "causa_material",
            "causa_material_detalhe",
            "causa_mao_de_obra",
            "causa_mao_de_obra_detalhe",
            "causa_maquina",
            "causa_maquina_detalhe",
            "causa_medicao",
            "causa_medicao_detalhe",
            "causa_meio_ambiente",
            "causa_meio_ambiente_detalhe",
            "data_prazo",
            "status",
            "status_efetivo",
            "eficacia",
            "data_conclusao",
            "criado_por",
            "created_at",
            "updated_at",
            "acoes_corretivas",
        ]
        read_only_fields = [
            "id",
            "projeto",
            "numero_sequencial",
            "status",
            "status_efetivo",
            "eficacia",
            "data_conclusao",
            "criado_por",
            "created_at",
            "updated_at",
        ]

    def get_status_efetivo(self, obj: RNC) -> str:
        return services.calcular_status_efetivo(obj)

    def validate(self, attrs):
        categoria = attrs.get("categoria", getattr(self.instance, "categoria", None))
        item = attrs.get("item", getattr(self.instance, "item", None))
        if categoria and item:
            services.validar_item_da_categoria(categoria=categoria, item=item)
        return attrs

    def create(self, validated_data):
        acoes_data = validated_data.pop("acoes_corretivas", [])
        rnc = RNC.objects.create(**validated_data)
        for acao_data in acoes_data:
            AcaoCorretiva.objects.create(rnc=rnc, **acao_data)
        return rnc

    def update(self, instance, validated_data):
        try:
            services.validar_rnc_editavel(instance)
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages}) from exc
        validated_data.pop("acoes_corretivas", None)
        return super().update(instance, validated_data)
