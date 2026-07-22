from django.db import migrations


def marcar_rdos_existentes_como_aprovados(apps, schema_editor):
    RegistroDiario = apps.get_model("registros_diarios", "RegistroDiario")
    RegistroDiario.objects.update(status="aprovado")


class Migration(migrations.Migration):

    dependencies = [
        ("registros_diarios", "0002_registrodiario_aprovado_em_and_more"),
    ]

    operations = [
        migrations.RunPython(
            marcar_rdos_existentes_como_aprovados,
            migrations.RunPython.noop,
        ),
    ]
