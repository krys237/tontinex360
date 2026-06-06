from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0001_initial'),
        ('approvals', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='bureauapprovalrequest',
            name='bureau_approval_2',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approval_requests_approved_bureau_2',
                to='members.membership',
                help_text="2ᵉ slot bureau requis uniquement si `requires_triple=True`.",
            ),
        ),
        migrations.AddField(
            model_name='bureauapprovalrequest',
            name='bureau_approval_2_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bureauapprovalrequest',
            name='requires_triple',
            field=models.BooleanField(
                default=False,
                help_text="True = nécessite Président + 2 autres membres bureau distincts.",
            ),
        ),
    ]
