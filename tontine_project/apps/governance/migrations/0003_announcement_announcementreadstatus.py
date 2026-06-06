import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0001_initial'),
        ('governance', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Announcement',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('content', models.TextField(help_text='Contenu en Markdown ou HTML')),
                ('priority', models.CharField(choices=[
                    ('low', 'Information'),
                    ('normal', 'Normal'),
                    ('high', 'Important'),
                    ('urgent', 'Urgent'),
                ], default='normal', max_length=10)),
                ('audience', models.CharField(choices=[
                    ('all', 'Tous les membres'),
                    ('bureau', 'Bureau uniquement'),
                    ('active', 'Membres actifs uniquement'),
                ], default='all', max_length=20)),
                ('is_pinned', models.BooleanField(default=False, help_text="Épingle l'annonce en haut de la liste.")),
                ('is_published', models.BooleanField(default=True)),
                ('starts_at', models.DateTimeField(blank=True, null=True, help_text='Date de début de publication (vide = immédiat).')),
                ('ends_at', models.DateTimeField(blank=True, null=True, help_text="Date d'expiration (vide = pas d'expiration).")),
                ('attachment', models.FileField(blank=True, null=True, upload_to='governance/announcements/')),
                ('association', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='announcement_set', to='core.association')),
                ('author', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='announcements_authored', to='members.membership')),
            ],
            options={
                'db_table': 'announcements',
                'ordering': ['-is_pinned', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['association', 'is_published', '-created_at'], name='announcemen_assoc_pub_idx'),
        ),
        migrations.AddIndex(
            model_name='announcement',
            index=models.Index(fields=['association', 'priority'], name='announcemen_assoc_prio_idx'),
        ),
        migrations.CreateModel(
            name='AnnouncementReadStatus',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('read_at', models.DateTimeField(auto_now_add=True)),
                ('announcement', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='read_statuses', to='governance.announcement')),
                ('association', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='announcementreadstatus_set', to='core.association')),
                ('membership', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='announcements_read', to='members.membership')),
            ],
            options={
                'db_table': 'announcement_read_status',
                'unique_together': {('announcement', 'membership')},
            },
        ),
    ]
