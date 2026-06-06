from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cycles', '0005_sessionreport_sessionreportattachment'),
    ]

    operations = [
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_signature',
            field=models.ImageField(
                blank=True, null=True,
                upload_to='payouts/signatures/',
                help_text='Signature du bénéficiaire au moment du versement.',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_signed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_device_info',
            field=models.JSONField(
                blank=True, default=dict,
                help_text='IP, user-agent, plateforme au moment de la signature.',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_hash',
            field=models.CharField(
                blank=True, max_length=64,
                help_text='SHA-256 du contenu du bordereau (intégrité).',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_pdf',
            field=models.FileField(
                blank=True, null=True,
                upload_to='payouts/receipts/',
                help_text='Bordereau PDF signé et hashé.',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='receipt_number',
            field=models.CharField(
                blank=True, max_length=50,
                help_text="Numéro séquentiel du bordereau dans l'association.",
            ),
        ),
        migrations.AddIndex(
            model_name='beneficiarypayout',
            index=models.Index(fields=['receipt_hash'], name='ben_payout_receipt_hash_idx'),
        ),
    ]
