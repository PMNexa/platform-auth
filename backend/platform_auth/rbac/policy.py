"""`CORE_API_ACCESS_POLICY = "platform_auth.rbac.policy.RBACPolicy"` - RBAC
for every `BaseViewSet` (see platform-core's core_api/access.py).

A request's rights: every role the user holds, app-wide or within a scope.
For `<resource>.<verb>` (`goals.update`):
- app-wide grant: allowed on every row;
- scoped grant: allowed on rows whose `scope_field` value is that scope;
  an unscoped row (no `scope_field`, or an empty one) needs app-wide.
Lists show only rows the user may `view`; a row they can't view is a 404
for every other verb too.
"""

from core_api.access import VIEW, AccessPolicy, action_verb, resource_key, scope_of
from platform_auth.models import RoleAssignment


class _Grants:
    def __init__(self, user_id):
        self._entries = []  # (scope_id str | None, grants_all, codenames)
        assignments = RoleAssignment.objects.filter(user_id=user_id).select_related("role").prefetch_related("role__permissions")
        for assignment in assignments:
            role = assignment.role
            codenames = frozenset(p.codename for p in role.permissions.all())
            scope = str(assignment.scope_id) if assignment.scope_id else None
            self._entries.append((scope, role.grants_all, codenames))

    def where(self, codename: str) -> tuple[bool, set[str]]:
        """(granted app-wide, the scopes it's granted in)."""
        everywhere, scopes = False, set()
        for scope, grants_all, codenames in self._entries:
            if grants_all or codename in codenames:
                if scope is None:
                    everywhere = True
                else:
                    scopes.add(scope)
        return everywhere, scopes

    def codenames(self, scope: str | None = None) -> set[str] | None:
        """Every codename granted app-wide (plus in `scope`); `None` = all."""
        result = set()
        for entry_scope, grants_all, codenames in self._entries:
            if entry_scope is None or entry_scope == scope:
                if grants_all:
                    return None
                result |= codenames
        return result


def grants_for(request) -> _Grants | None:
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    cached = getattr(request, "_rbac_grants", None)
    if cached is None:
        cached = _Grants(user.id)
        request._rbac_grants = cached
    return cached


class RBACPolicy(AccessPolicy):
    def _where(self, request, view, verb=None):
        return grants_for(request).where(f"{resource_key(view)}.{verb or action_verb(view)}")

    def has_permission(self, request, view):
        # Unauthenticated: the viewset's own IsAuthenticated answers (401).
        if grants_for(request) is None or resource_key(view) is None:
            return True
        everywhere, scopes = self._where(request, view)
        return everywhere or bool(scopes)

    def has_object_permission(self, request, view, obj):
        if grants_for(request) is None or resource_key(view) is None:
            return True
        everywhere, scopes = self._where(request, view)
        if everywhere:
            return True
        scope = scope_of(obj, getattr(view, "scope_field", None))
        return scope is not None and str(scope) in scopes

    def allows(self, request, view, verb):
        if grants_for(request) is None or resource_key(view) is None:
            return True
        everywhere, scopes = self._where(request, view, verb)
        return everywhere or bool(scopes)

    def filter_queryset(self, request, view, queryset):
        if grants_for(request) is None:
            return queryset.none()
        if resource_key(view) is None:
            return queryset
        everywhere, scopes = self._where(request, view, VIEW)
        if everywhere:
            return queryset
        scope_field = getattr(view, "scope_field", None)
        if not scope_field or not scopes:
            return queryset.none()
        return queryset.filter(**{f"{scope_field}__in": scopes})
