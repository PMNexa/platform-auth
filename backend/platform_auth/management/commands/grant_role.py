from django.core.management.base import BaseCommand, CommandError

from platform_auth.models import Role, RoleAssignment, User


class Command(BaseCommand):
    help = "Give a user a role, app-wide or within one scope - e.g. to bootstrap the first admin."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("role", help="Role name, e.g. Admin")
        parser.add_argument("--scope", help="Scope id (e.g. an organization's); omit for app-wide")

    def handle(self, *args, email, role, scope=None, **options):
        try:
            user = User.objects.get(email=email.lower())
            role_obj = Role.objects.get(name=role)
        except User.DoesNotExist:
            raise CommandError(f"No user with email {email}.") from None
        except Role.DoesNotExist:
            raise CommandError(f"No role named {role}.") from None
        _, created = RoleAssignment.objects.get_or_create(user=user, role=role_obj, scope_id=scope)
        where = f"in scope {scope}" if scope else "app-wide"
        self.stdout.write(f"{user.email}: {role_obj.name} {where} ({'granted' if created else 'already held'}).")
