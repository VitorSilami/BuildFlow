from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("configuracoes", "0005_valorcusto_funcao_valorcusto_maquina_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="disciplina",
            name="peso_percentual",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
                verbose_name="peso percentual",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="peso_percentual",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=5,
                null=True,
                verbose_name="peso percentual",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="quantidade_planejada",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                max_digits=12,
                null=True,
                verbose_name="quantidade planejada",
            ),
        ),
        migrations.AddField(
            model_name="catalogoservico",
            name="quantidade_executada",
            field=models.DecimalField(
                decimal_places=3,
                default=Decimal("0"),
                max_digits=12,
                verbose_name="quantidade executada",
            ),
        ),
    ]
