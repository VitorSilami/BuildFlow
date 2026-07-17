from django.contrib import admin

from .models import Projeto


@admin.register(Projeto)
class ProjetoAdmin(admin.ModelAdmin):
    list_display = ["nome", "empresa", "criado_por", "created_at"]
    list_filter = ["empresa"]
    search_fields = ["nome"]
