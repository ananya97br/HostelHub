from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AccountProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("Admin", "Admin"),
                            ("Warden", "Warden"),
                            ("Maintenance", "Maintenance"),
                            ("Student", "Student"),
                        ],
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "student_id",
                    models.PositiveIntegerField(blank=True, null=True, unique=True),
                ),
                (
                    "staff_id",
                    models.PositiveIntegerField(blank=True, null=True, unique=True),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="dorm_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "core_accountprofile"},
        ),
    ]
