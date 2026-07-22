import datetime

from django.core.management.base import BaseCommand
from django.db import transaction

from buildflow.configuracoes.models import CatalogoServico
from buildflow.configuracoes.models import Disciplina
from buildflow.configuracoes.models import Equipe
from buildflow.configuracoes.models import Maquina
from buildflow.configuracoes.models import MetaMensal
from buildflow.configuracoes.models import MotivoParada
from buildflow.configuracoes.models import Pessoa
from buildflow.configuracoes.models import Unidade
from buildflow.configuracoes.models import ValorCusto
from buildflow.empresas.models import Empresa
from buildflow.projetos.models import Projeto
from buildflow.registros_diarios.models import ApontamentoMaquina
from buildflow.registros_diarios.models import Presenca
from buildflow.registros_diarios.models import ProducaoDiaria
from buildflow.registros_diarios.models import RegistroDiario
from buildflow.usuarios.models import PerfilChoices
from buildflow.usuarios.models import User

EMPRESAS_DEMO = [
    {"nome": "Construtora Alfa", "slug": "construtora-alfa"},
    {"nome": "Construtora Beta", "slug": "construtora-beta"},
]


class Command(BaseCommand):
    help = (
        "Popula o banco com 2 empresas, usuários, projetos, RDOs e configurações "
        "de exemplo."
    )

    def handle(self, *args, **options):
        with transaction.atomic():
            for empresa_data in EMPRESAS_DEMO:
                self._seed_empresa(empresa_data)
        self.stdout.write(
            self.style.SUCCESS("Dados de demonstração criados com sucesso."),
        )

    def _seed_empresa(self, empresa_data: dict) -> None:
        empresa, _created = Empresa.objects.get_or_create(
            slug=empresa_data["slug"],
            defaults={"nome": empresa_data["nome"]},
        )

        gerente = self._seed_usuario(empresa, "gerente", PerfilChoices.GERENTE)
        self._seed_usuario(empresa, "auxiliar", PerfilChoices.AUXILIAR_ADMINISTRATIVO)

        for indice_projeto in range(1, 3):
            projeto, criado = Projeto.objects.get_or_create(
                empresa=empresa,
                nome=f"Obra {indice_projeto} — {empresa.nome}",
                defaults={
                    "descricao": "Projeto de demonstração criado por seed_demo_data.",
                    "criado_por": gerente,
                },
            )
            if criado:
                self._seed_configuracao_e_rdo(projeto, gerente)

    def _seed_usuario(self, empresa: Empresa, prefixo: str, perfil: str) -> User:
        email = f"{prefixo}@{empresa.slug}.buildflow.local"
        usuario, criado = User.objects.get_or_create(
            email=email,
            defaults={
                "nome": f"{perfil.replace('_', ' ').title()} {empresa.nome}",
                "empresa": empresa,
                "perfil": perfil,
                "is_active": True,
            },
        )
        if criado:
            usuario.set_unusable_password()
            usuario.save(update_fields=["password"])
        return usuario

    def _seed_configuracao_e_rdo(self, projeto: Projeto, autor: User) -> None:
        unidade, _ = Unidade.objects.get_or_create(
            sigla="m³",
            defaults={"descricao": "metro cúbico"},
        )

        disciplina = Disciplina.objects.create(projeto=projeto, nome="Terraplenagem")
        servico = CatalogoServico.objects.create(
            disciplina=disciplina,
            nome="Corte",
            unidade=unidade,
        )

        MetaMensal.objects.create(
            projeto=projeto,
            disciplina=disciplina,
            unidade=unidade,
            valor_alvo=1000,
            peso_percentual=100,
        )

        equipe = Equipe.objects.create(projeto=projeto, nome="Equipe 1")
        pessoa = Pessoa.objects.create(
            equipe=equipe,
            nome="José Ajudante",
            funcao="Ajudante",
        )
        maquina = Maquina.objects.create(
            equipe=equipe,
            codigo="ESC-01",
            nome="Escavadeira 320D",
        )

        ValorCusto.objects.create(
            projeto=projeto,
            tipo="mao_de_obra",
            descricao="Ajudante",
            funcao="Ajudante",
            valor=250,
        )
        ValorCusto.objects.create(
            projeto=projeto,
            tipo="equipamento",
            descricao="Escavadeira 320D",
            maquina=maquina,
            valor=180,
        )

        registro = RegistroDiario.objects.create(
            projeto=projeto,
            data_referencia=datetime.datetime.now(tz=datetime.UTC).date(),
            turno="diurno",
            clima="sol",
            equipe=equipe,
            fiscal=autor,
            autor=autor,
        )
        ProducaoDiaria.objects.create(
            registro_diario=registro,
            rodovia="BR-365",
            sentido="crescente",
            disciplina=disciplina,
            servico=servico,
            km_inicial="10.000",
            km_final="10.500",
            quantidade="500.000",
            unidade=unidade,
        )
        motivo_chuva, _ = MotivoParada.objects.get_or_create(descricao="Chuva")
        Presenca.objects.create(
            registro_diario=registro,
            pessoa=pessoa,
            funcao="Ajudante",
            status="presente",
            origem="composicao",
        )
        ApontamentoMaquina.objects.create(
            registro_diario=registro,
            maquina=maquina,
            horas_produtivas="7.00",
            horas_paradas="1.00",
            motivo_parada=motivo_chuva,
            origem="composicao",
        )
