from decimal import Decimal

from django.db import migrations, models
from django.utils.translation import gettext_lazy as _


class Migration(migrations.Migration):
    dependencies = [
        ("configuracoes", "0008_remove_metamensal"),
    ]

    operations = [
        migrations.RenameField(
            model_name="catalogoservico",
            old_name="quantidade_executada",
            new_name="quantidade_executada_manual",
        ),
        migrations.AlterField(
            model_name="catalogoservico",
            name="quantidade_executada_manual",
            field=models.DecimalField(
                default=Decimal("0"),
                decimal_places=3,
                max_digits=12,
                verbose_name=_("quantidade executada (ajuste manual)"),
            ),
        ),
    ]
