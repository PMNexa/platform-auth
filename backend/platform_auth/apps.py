from django.apps import AppConfig
from django.db.models.signals import post_migrate, post_save


class PlatformAuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'platform_auth'

    def ready(self):
        from platform_auth.rbac import signals

        post_migrate.connect(signals.sync_after_migrate, sender=self)
        post_save.connect(signals.assign_default_roles, sender=self.get_model("User"))
