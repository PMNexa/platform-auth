"""Creates the host's default roles (RBAC_DEFAULT_ROLES) and gives every
EXISTING user the `is_default` ones app-wide - once, so users who signed
up before RBAC keep working. New users get them from a post_save signal;
permissions are attached by the post-migrate catalog sync."""

from django.db import migrations

from platform_auth.rbac.settings import default_roles


def forwards(apps, schema_editor):
    Role = apps.get_model("platform_auth", "Role")
    RoleAssignment = apps.get_model("platform_auth", "RoleAssignment")
    User = apps.get_model("platform_auth", "User")
    for spec in default_roles():
        role, _ = Role.objects.get_or_create(
            name=spec["name"],
            defaults={
                "description": spec.get("description", ""),
                "is_default": spec.get("is_default", False),
                "grants_all": spec.get("grants_all", False),
            },
        )
        if role.is_default:
            for user in User.objects.all():
                RoleAssignment.objects.get_or_create(user=user, role=role, scope_id=None)


class Migration(migrations.Migration):
    dependencies = [("platform_auth", "0002_rbac")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
