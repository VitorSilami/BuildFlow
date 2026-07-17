from rest_framework import serializers

from buildflow.usuarios.models import User


class UserSerializer(serializers.ModelSerializer[User]):
    empresa_nome = serializers.CharField(source="empresa.nome", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "nome", "perfil", "empresa", "empresa_nome"]
        read_only_fields = ["id", "email", "empresa", "perfil"]
