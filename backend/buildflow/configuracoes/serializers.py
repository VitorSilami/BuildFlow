from rest_framework import serializers

from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import decimal_para_str_ou_none

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto


class UnidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidade
        fields = ["id", "sigla", "descricao"]


class MotivoParadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoParada
        fields = ["id", "descricao"]


class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()

    class Meta:
        model = CatalogoServico
        fields = [
            "id",
            "nome",
            "unidade",
            "peso_percentual",
            "quantidade_planejada",
            "quantidade_executada",
            "avanco_percentual",
        ]

    def get_avanco_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_servico(obj))


class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = ["id", "nome", "peso_percentual", "servicos", "avanco_percentual"]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_disciplina(obj))


class PessoaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pessoa
        fields = ["id", "nome", "funcao"]


class MaquinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Maquina
        fields = ["id", "codigo", "nome"]


class EquipeSerializer(serializers.ModelSerializer):
    pessoas = PessoaSerializer(many=True, read_only=True)
    maquinas = MaquinaSerializer(many=True, read_only=True)

    class Meta:
        model = Equipe
        fields = ["id", "nome", "encarregado", "pessoas", "maquinas"]


class ValorCustoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ValorCusto
        fields = ["id", "tipo", "descricao", "valor", "funcao", "maquina"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        services.validar_valor_custo(
            tipo=attrs.get("tipo"),
            funcao=attrs.get("funcao", ""),
            maquina=attrs.get("maquina"),
        )
        return attrs
