from rest_framework import serializers

from . import services
from .models import ApontamentoMaquina
from .models import Foto
from .models import Ocorrencia
from .models import OrigemChoices
from .models import Presenca
from .models import ProducaoDiaria
from .models import RegistroDiario


class ProducaoDiariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProducaoDiaria
        fields = [
            "id",
            "rodovia",
            "sentido",
            "disciplina",
            "servico",
            "km_inicial",
            "km_final",
            "quantidade",
            "unidade",
        ]
        read_only_fields = ["id"]


class PresencaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Presenca
        fields = ["id", "pessoa", "nome_avulso", "funcao", "status"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        services.validar_presenca(
            pessoa=attrs.get("pessoa"),
            nome_avulso=attrs.get("nome_avulso", ""),
        )
        return attrs


class ApontamentoMaquinaSerializer(serializers.ModelSerializer):
    eficiencia = serializers.FloatField(read_only=True)

    class Meta:
        model = ApontamentoMaquina
        fields = [
            "id",
            "maquina",
            "identificacao_avulsa",
            "horas_produtivas",
            "horas_paradas",
            "motivo_parada",
            "eficiencia",
        ]
        read_only_fields = ["id", "eficiencia"]

    def validate(self, attrs):
        services.validar_apontamento_maquina(
            maquina=attrs.get("maquina"),
            identificacao_avulsa=attrs.get("identificacao_avulsa", ""),
            horas_paradas=attrs.get("horas_paradas"),
            motivo_parada=attrs.get("motivo_parada"),
        )
        return attrs


class OcorrenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ocorrencia
        fields = ["id", "tipo", "recurso_afetado", "descricao"]
        read_only_fields = ["id"]


class FotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Foto
        fields = ["id", "arquivo", "km", "created_at"]
        read_only_fields = ["id", "created_at"]


class RegistroDiarioSerializer(serializers.ModelSerializer):
    producoes = ProducaoDiariaSerializer(many=True)
    presencas = PresencaSerializer(many=True)
    maquinas = ApontamentoMaquinaSerializer(many=True)
    ocorrencias = OcorrenciaSerializer(many=True, required=False, default=[])
    fotos = FotoSerializer(many=True, read_only=True)

    class Meta:
        model = RegistroDiario
        fields = [
            "id",
            "data_referencia",
            "turno",
            "clima",
            "equipe",
            "fiscal",
            "autor",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
            "updated_at",
            "producoes",
            "presencas",
            "maquinas",
            "ocorrencias",
            "fotos",
        ]
        read_only_fields = [
            "id",
            "autor",
            "status",
            "motivo_rejeicao",
            "aprovado_em",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        producoes_data = validated_data.pop("producoes")
        presencas_data = validated_data.pop("presencas")
        maquinas_data = validated_data.pop("maquinas")
        ocorrencias_data = validated_data.pop("ocorrencias", [])

        registro = RegistroDiario.objects.create(**validated_data)

        for producao_data in producoes_data:
            ProducaoDiaria.objects.create(registro_diario=registro, **producao_data)
        for presenca_data in presencas_data:
            origem = (
                OrigemChoices.COMPOSICAO
                if presenca_data.get("pessoa")
                else OrigemChoices.AVULSO
            )
            Presenca.objects.create(
                registro_diario=registro,
                origem=origem,
                **presenca_data,
            )
        for maquina_data in maquinas_data:
            origem = (
                OrigemChoices.COMPOSICAO
                if maquina_data.get("maquina")
                else OrigemChoices.AVULSO
            )
            ApontamentoMaquina.objects.create(
                registro_diario=registro,
                origem=origem,
                **maquina_data,
            )
        for ocorrencia_data in ocorrencias_data:
            Ocorrencia.objects.create(registro_diario=registro, **ocorrencia_data)

        return registro
