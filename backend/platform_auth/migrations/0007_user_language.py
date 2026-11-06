from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('platform_auth', '0006_native_sessions'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='language',
            field=models.CharField(blank=True, db_default='', default='', max_length=10),
        ),
    ]
