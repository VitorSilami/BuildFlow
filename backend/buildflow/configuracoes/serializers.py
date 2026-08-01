from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from rest_framework import serializers

from buildflow.projetos.services import calcular_avanco_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_disciplina
from buildflow.projetos.services import calcular_avanco_previsto_servico
from buildflow.projetos.services import calcular_avanco_servico
from buildflow.projetos.services import calcular_carta_controle
from buildflow.projetos.services import calcular_janela_disciplina
from buildflow.projetos.services import calcular_quantidade_executada_total
from buildflow.projetos.services import calcular_status_eap_disciplina
from buildflow.projetos.services import classificar_status_eap
from buildflow.projetos.services import decimal_para_str_ou_none
from buildflow.projetos.services import listar_producoes_vinculadas

from . import services
from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto

if TYPE_CHECKING:
    import datetime


class UnidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unidade
        fields = ["id", "sigla", "descricao"]


class MotivoParadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MotivoParada
        fields = ["id", "descricao"]


class CatalogoServicoResumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogoServico
        fields = ["id", "nome", "unidade"]


class DisciplinaResumoSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoResumoSerializer(many=True, read_only=True)

    class Meta:
        model = Disciplina
        fields = ["id", "nome", "servicos"]


class CatalogoServicoSerializer(serializers.ModelSerializer):
    avanco_percentual = serializers.SerializerMethodField()
    quantidade_executada = serializers.SerializerMethodField()
    producoes_vinculadas = serializers.SerializerMethodField()
    carta_controle = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()

    class Meta:
        model = CatalogoServico
        fields = [
            "id",
            "nome",
            "unidade",
            "peso_percentual",
            "quantidade_planejada",
            "quantidade_executada_manual",
            "quantidade_executada",
            "producoes_vinculadas",
            "carta_controle",
            "avanco_percentual",
            "data_inicio_prevista",
            "data_fim_prevista",
            "avanco_previsto_percentual",
            "status_eap",
        ]

    def _avanco_real(self, obj: CatalogoServico) -> Decimal | None:
        cache = self.context.setdefault("_avanco_real_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_avanco_servico(obj)
        return cache[obj.pk]

    def get_avanco_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(self._avanco_real(obj))

    def get_quantidade_executada(self, obj: CatalogoServico) -> str:
        total = calcular_quantidade_executada_total(obj)
        return str(total.quantize(Decimal("0.001")))

    def get_producoes_vinculadas(self, obj: CatalogoServico) -> list[dict]:
        return [
            {
                "data_referencia": producao.registro_diario.data_referencia.isoformat(),
                "quantidade": str(producao.quantidade),
            }
            for producao in listar_producoes_vinculadas(obj)
        ]

    def get_carta_controle(self, obj: CatalogoServico) -> dict | None:
        cc = calcular_carta_controle(obj)
        if cc is None:
            return None
        return {
            "media": str(cc.media),
            "desvio_padrao": str(cc.desvio_padrao),
            "lsc": str(cc.lsc),
            "lic": str(cc.lic),
            "pontos": [
                {
                    "data_referencia": p.data_referencia.isoformat(),
                    "quantidade": str(p.quantidade),
                    "fora_de_controle": p.fora_de_controle,
                }
                for p in cc.pontos
            ],
        }

    def get_avanco_previsto_percentual(self, obj: CatalogoServico) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_servico(obj))

    def get_status_eap(self, obj: CatalogoServico) -> str | None:
        return classificar_status_eap(
            self._avanco_real(obj),
            calcular_avanco_previsto_servico(obj),
        )

    def validate(self, attrs):
        inicio = attrs.get(
            "data_inicio_prevista",
            getattr(self.instance, "data_inicio_prevista", None),
        )
        fim = attrs.get(
            "data_fim_prevista",
            getattr(self.instance, "data_fim_prevista", None),
        )
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError(
                {
                    "data_fim_prevista": (
                        "Data de fim prevista não pode ser anterior "
                        "à data de início prevista."
                    ),
                },
            )
        return attrs


class DisciplinaSerializer(serializers.ModelSerializer):
    servicos = CatalogoServicoSerializer(many=True, read_only=True)
    avanco_percentual = serializers.SerializerMethodField()
    avanco_previsto_percentual = serializers.SerializerMethodField()
    status_eap = serializers.SerializerMethodField()
    data_inicio_prevista = serializers.SerializerMethodField()
    data_fim_prevista = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            "id",
            "nome",
            "peso_percentual",
            "pai",
            "servicos",
            "avanco_percentual",
            "avanco_previsto_percentual",
            "status_eap",
            "data_inicio_prevista",
            "data_fim_prevista",
        ]

    def validate_pai(self, pai: Disciplina | None) -> Disciplina | None:
        if pai is None:
            return pai

        projeto_id = self.instance.projeto_id if self.instance else self.context["projeto"].id
        if pai.projeto_id != projeto_id:
            msg = "A disciplina pai deve pertencer ao mesmo projeto."
            raise serializers.ValidationError(msg)

        if self.instance is not None:
            cursor: Disciplina | None = pai
            while cursor is not None:
                if cursor.id == self.instance.id:
                    msg = "Uma disciplina não pode ser sua própria ancestral."
                    raise serializers.ValidationError(msg)
                cursor = cursor.pai

        return pai

    def _avanco_real(self, obj: Disciplina) -> Decimal | None:
        cache = self.context.setdefault("_avanco_real_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_avanco_disciplina(obj)
        return cache[obj.pk]

    def get_avanco_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(self._avanco_real(obj))

    def get_avanco_previsto_percentual(self, obj: Disciplina) -> str | None:
        return decimal_para_str_ou_none(calcular_avanco_previsto_disciplina(obj))

    def get_status_eap(self, obj: Disciplina) -> str | None:
        return calcular_status_eap_disciplina(obj)

    def _janela(self, obj: Disciplina) -> tuple[datetime.date, datetime.date] | None:
        cache = self.context.setdefault("_janela_disciplina_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = calcular_janela_disciplina(obj)
        return cache[obj.pk]

    def get_data_inicio_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[0].isoformat() if janela else None

    def get_data_fim_prevista(self, obj: Disciplina) -> str | None:
        janela = self._janela(obj)
        return janela[1].isoformat() if janela else None


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
