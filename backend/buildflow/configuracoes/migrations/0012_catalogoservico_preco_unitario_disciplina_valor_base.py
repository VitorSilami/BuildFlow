from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('configuracoes', '0011_disciplina_pai'),
    ]

    operations = [
        migrations.AddField(
            model_name='catalogoservico',
            name='preco_unitario',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='preço unitário'),
        ),
        migrations.AddField(
            model_name='disciplina',
            name='valor_base',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='valor base'),
        ),
    ]
