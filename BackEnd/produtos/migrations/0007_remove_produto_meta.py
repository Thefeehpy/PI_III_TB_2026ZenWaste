# Generated for ZenWaste inventory without target goals.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("produtos", "0006_inventory_fields_and_movements"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" DROP COLUMN IF EXISTS "meta_quantidade";',
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE "produtos_produto" DROP COLUMN IF EXISTS "prazo_meta";',
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.RemoveField(
                    model_name="produto",
                    name="meta_quantidade",
                ),
                migrations.RemoveField(
                    model_name="produto",
                    name="prazo_meta",
                ),
            ],
        ),
    ]
