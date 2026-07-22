from rest_framework import serializers

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MetaMensal
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
    class Meta:
        model = CatalogoServico
        fields = ["id", "nome", "unidade"]


class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)

    class Meta:
        model = Disciplina
        fields = ["id", "nome", "servicos"]


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


class MetaMensalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaMensal
        fields = ["id", "disciplina", "unidade", "valor_alvo", "peso_percentual"]


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
