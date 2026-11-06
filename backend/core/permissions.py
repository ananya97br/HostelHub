from __future__ import annotations

from typing import Iterable

from django.db import models
from django.db.utils import OperationalError, ProgrammingError
from rest_framework.permissions import BasePermission

from .models import AccountProfile, Hostel


def get_profile(user):
    """Return the explicit DormDesk profile, if one is provisioned."""

    if not user or not user.is_authenticated:
        return None

    try:
        return user.dorm_profile
    except (AccountProfile.DoesNotExist, OperationalError, ProgrammingError):
        return None


def get_role(user) -> str | None:
    profile = get_profile(user)
    if profile is not None:
        return profile.role

    # Keep the existing superuser usable as the initial administrator.  A
    # normal Django is_staff flag is deliberately not treated as a DormDesk
    # role.
    if user and user.is_authenticated and user.is_superuser:
        return AccountProfile.ROLE_ADMIN

    return None


def is_admin(user) -> bool:
    return get_role(user) == AccountProfile.ROLE_ADMIN


def linked_student_id(user) -> int | None:
    profile = get_profile(user)
    if profile and profile.student_id:
        return profile.student_id
    return None


def linked_staff_id(user) -> int | None:
    profile = get_profile(user)
    if profile and profile.staff_id:
        return profile.staff_id
    return None


def assigned_hostel_ids(user) -> list[int]:
    """Return hostels a staff member may manage.

    Both legacy assignment conventions are supported: Staff.hostel_id and
    Hostel.warden_id.  This also makes the permission logic safe while old
    data is being migrated or reconciled.
    """

    staff_id = linked_staff_id(user)
    if not staff_id:
        return []

    return list(
        Hostel.objects.filter(
            models.Q(warden_id=staff_id) | models.Q(warden__hostel_id=staff_id)
        )
        .values_list("hostel_id", flat=True)
        .distinct()
    )


def hostel_ids_for_staff(user) -> list[int]:
    """Backward-compatible alias used by query-scoping helpers."""

    return assigned_hostel_ids(user)


class DormRolePermission(BasePermission):
    allowed_roles: Iterable[str] = ()

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_role(request.user) in set(self.allowed_roles)
        )


class AdminPermission(DormRolePermission):
    allowed_roles = (AccountProfile.ROLE_ADMIN,)


class AdminOrWardenPermission(DormRolePermission):
    allowed_roles = (AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_WARDEN)


class AdminOrStudentPermission(DormRolePermission):
    allowed_roles = (AccountProfile.ROLE_ADMIN, AccountProfile.ROLE_STUDENT)


class StaffPermission(DormRolePermission):
    allowed_roles = (
        AccountProfile.ROLE_ADMIN,
        AccountProfile.ROLE_WARDEN,
        AccountProfile.ROLE_MAINTENANCE,
    )


class AnyDormUserPermission(DormRolePermission):
    allowed_roles = (
        AccountProfile.ROLE_ADMIN,
        AccountProfile.ROLE_WARDEN,
        AccountProfile.ROLE_MAINTENANCE,
        AccountProfile.ROLE_STUDENT,
    )
