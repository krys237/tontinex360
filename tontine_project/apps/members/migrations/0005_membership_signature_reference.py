from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0004_membership_is_founder'),
    ]

    operations = [
        migrations.AddField(
            model_name='membership',
            name='signature_reference',
            field=models.ImageField(
                blank=True, null=True,
                upload_to='members/signatures/',
                help_text='Signature de référence du membre.',
            ),
        ),
        migrations.AddField(
            model_name='membership',
            name='signature_reference_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
