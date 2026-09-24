from platform_auth.models import Role, RoleAssignment


def sync_after_migrate(sender, **kwargs):
    """Keeps the permission catalog in step with the registered resources
    on every `migrate` (see catalog.py)."""
    from platform_auth.rbac.catalog import sync_catalog

    sync_catalog()


def assign_default_roles(sender, instance, created, raw=False, **kwargs):
    """A new user gets every `is_default` role, app-wide."""
    if not created or raw:
        return
    for role in Role.objects.filter(is_default=True):
        RoleAssignment.objects.get_or_create(user=instance, role=role, scope_id=None)
