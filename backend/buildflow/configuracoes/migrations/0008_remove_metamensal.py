from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("configuracoes", "0007_copiar_peso_metamensal_para_disciplina"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="metamensal",
            name="meta_unica_por_disciplina_e_projeto",
        ),
        migrations.DeleteModel(
            name="MetaMensal",
        ),
    ]
