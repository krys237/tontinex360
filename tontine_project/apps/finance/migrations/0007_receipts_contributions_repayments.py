from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_rename_tx_assoc_tt_created_idx_transaction_associa_b4a289_idx'),
    ]

    operations = [
        # Contribution
        migrations.AddField(
            model_name='contribution',
            name='receipt_signature',
            field=models.ImageField(blank=True, null=True, upload_to='contributions/signatures/'),
        ),
        migrations.AddField(
            model_name='contribution',
            name='receipt_signed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='contribution',
            name='receipt_device_info',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='contribution',
            name='receipt_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='contribution',
            name='receipt_pdf',
            field=models.FileField(blank=True, null=True, upload_to='contributions/receipts/'),
        ),
        # LoanRepayment
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_signature',
            field=models.ImageField(blank=True, null=True, upload_to='loan_repayments/signatures/'),
        ),
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_signed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_device_info',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_pdf',
            field=models.FileField(blank=True, null=True, upload_to='loan_repayments/receipts/'),
        ),
        migrations.AddField(
            model_name='loanrepayment',
            name='receipt_number',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
