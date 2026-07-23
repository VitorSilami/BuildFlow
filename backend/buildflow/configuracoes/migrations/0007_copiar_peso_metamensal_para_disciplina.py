from django.db import migrations


def copiar_peso_percentual_para_disciplina(apps, schema_editor):
    MetaMensal = apps.get_model("configuracoes", "MetaMensal")
    for meta in MetaMensal.objects.select_related("disciplina").all():
        if meta.peso_percentual is not None:
            disciplina = meta.disciplina
            disciplina.peso_percentual = meta.peso_percentual
            disciplina.save(update_fields=["peso_percentual"])


class Migration(migrations.Migration):
    dependencies = [
        ("configuracoes", "0006_disciplina_peso_catalogoservico_peso_quantidade"),
    ]

    operations = [
        migrations.RunPython(
            copiar_peso_percentual_para_disciplina,
            migrations.RunPython.noop,
        ),
    ]
