from rest_framework import serializers

from .models import Projeto


class ProjetoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projeto
        fields = ["id", "nome", "descricao", "criado_por", "created_at", "updated_at"]
        read_only_fields = ["id", "criado_por", "created_at", "updated_at"]

    def validate_nome(self, value: str) -> str:
        # FR-016: rejeitar nome vazio ou composto somente por espacos.
        if not value.strip():
            msg = "O nome do projeto não pode ser vazio."
            raise serializers.ValidationError(msg)
        return value.strip()
