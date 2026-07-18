from rest_framework import serializers

from .models import Projeto
from .services import calcular_execucao_percentual


class ProjetoSerializer(serializers.ModelSerializer):
    execucao_percentual = serializers.SerializerMethodField()

    class Meta:
        model = Projeto
        fields = [
            "id",
            "nome",
            "descricao",
            "numero_contrato",
            "trecho",
            "engenheiro_responsavel",
            "status",
            "execucao_percentual",
            "criado_por",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "criado_por", "created_at", "updated_at"]

    def get_execucao_percentual(self, obj: Projeto) -> str | None:
        valor = calcular_execucao_percentual(obj)
        return str(valor) if valor is not None else None

    def validate_nome(self, value: str) -> str:
        # FR-016: rejeitar nome vazio ou composto somente por espacos.
        if not value.strip():
            msg = "O nome do projeto não pode ser vazio."
            raise serializers.ValidationError(msg)
        return value.strip()
