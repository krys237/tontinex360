import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('cycles', '0001_initial'),
        ('members', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MembershipRequest',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('motivation', models.TextField(blank=True, help_text="Lettre de motivation / raison de la demande.")),
                ('contact_phone', models.CharField(blank=True, max_length=20)),
                ('contact_email', models.EmailField(blank=True, max_length=254)),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('approved', 'Approuvée'), ('rejected', 'Rejetée'), ('cancelled', 'Annulée')], db_index=True, default='pending', max_length=20)),
                ('review_note', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='membership_requests', to=settings.AUTH_USER_MODEL)),
                ('cycle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='membership_requests', to='cycles.cycle')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='membership_requests_reviewed', to='members.membership')),
                ('resulting_membership', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='originating_request', to='members.membership')),
            ],
            options={
                'db_table': 'membership_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='membershiprequest',
            index=models.Index(fields=['association', 'status'], name='memb_req_assoc_status_idx'),
        ),
        migrations.AddIndex(
            model_name='membershiprequest',
            index=models.Index(fields=['user', 'status'], name='memb_req_user_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='membershiprequest',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')),
                fields=('association', 'user'),
                name='unique_pending_membership_request_per_user',
            ),
        ),
        migrations.CreateModel(
            name='Resignation',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reason', models.TextField(help_text='Motif de démission obligatoire.')),
                ('effective_date', models.DateField(blank=True, help_text="Date souhaitée d'effet (sinon date de l'approbation).", null=True)),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('approved', 'Approuvée'), ('rejected', 'Rejetée'), ('cancelled', 'Annulée')], db_index=True, default='pending', max_length=20)),
                ('review_note', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('membership', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='resignations', to='members.membership')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='resignations_reviewed', to='members.membership')),
            ],
            options={
                'db_table': 'resignations',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='resignation',
            index=models.Index(fields=['association', 'status'], name='resig_assoc_status_idx'),
        ),
        migrations.AddIndex(
            model_name='resignation',
            index=models.Index(fields=['membership', 'status'], name='resig_memb_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='resignation',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', 'pending')),
                fields=('association', 'membership'),
                name='unique_pending_resignation_per_membership',
            ),
        ),
    ]
