from django.contrib import admin

from .models import CatalogoServico
from .models import Disciplina
from .models import Equipe
from .models import Maquina
from .models import MetaMensal
from .models import MotivoParada
from .models import Pessoa
from .models import Unidade
from .models import ValorCusto


@admin.register(Unidade)
class UnidadeAdmin(admin.ModelAdmin):
    list_display = ["sigla", "descricao"]
    search_fields = ["sigla"]


@admin.register(MotivoParada)
class MotivoParadaAdmin(admin.ModelAdmin):
    list_display = ["descricao"]
    search_fields = ["descricao"]


class CatalogoServicoInline(admin.TabularInline):
    model = CatalogoServico
    extra = 1


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ["nome", "projeto"]
    list_filter = ["projeto"]
    search_fields = ["nome"]
    inlines = [CatalogoServicoInline]


class PessoaInline(admin.TabularInline):
    model = Pessoa
    extra = 1
    fk_name = "equipe"


class MaquinaInline(admin.TabularInline):
    model = Maquina
    extra = 1


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ["nome", "projeto", "encarregado"]
    list_filter = ["projeto"]
    search_fields = ["nome"]
    inlines = [PessoaInline, MaquinaInline]


@admin.register(MetaMensal)
class MetaMensalAdmin(admin.ModelAdmin):
    list_display = ["disciplina", "projeto", "valor_alvo", "unidade", "peso_percentual"]
    list_filter = ["projeto"]


@admin.register(ValorCusto)
class ValorCustoAdmin(admin.ModelAdmin):
    list_display = ["descricao", "tipo", "valor", "projeto"]
    list_filter = ["projeto", "tipo"]
    search_fields = ["descricao"]
