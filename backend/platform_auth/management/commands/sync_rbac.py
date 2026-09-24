from django.core.management.base import BaseCommand

from platform_auth.rbac.catalog import sync_catalog


class Command(BaseCommand):
    help = "Create missing permissions (one per registered resource and verb) and default roles."

    def handle(self, *args, **options):
        result = sync_catalog()
        self.stdout.write(f"{result['permissions']} new permission(s), {result['roles']} new role(s).")
