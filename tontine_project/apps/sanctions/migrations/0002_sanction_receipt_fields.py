from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sanctions', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sanction',
            name='receipt_signature',
            field=models.ImageField(blank=True, null=True, upload_to='sanctions/signatures/'),
        ),
        migrations.AddField(
            model_name='sanction',
            name='receipt_signed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sanction',
            name='receipt_device_info',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='sanction',
            name='receipt_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='sanction',
            name='receipt_pdf',
            field=models.FileField(blank=True, null=True, upload_to='sanctions/receipts/'),
        ),
        migrations.AddField(
            model_name='sanction',
            name='receipt_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddIndex(
            model_name='sanction',
            index=models.Index(fields=['receipt_hash'], name='sanction_receipt_hash_idx'),
        ),
    ]
