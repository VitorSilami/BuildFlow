from django.contrib import admin

from .models import Empresa


@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ["nome", "slug", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["nome", "slug"]
    prepopulated_fields = {"slug": ("nome",)}
