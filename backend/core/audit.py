from __future__ import annotations

from django.db.utils import OperationalError, ProgrammingError

from .models import AuditLog


def record_audit(
    request,
    *,
    action: str,
    resource_type: str,
    resource_id: int | None = None,
    hostel_id: int | None = None,
    details: dict | None = None,
):
    """Write an audit event without allowing observability to break a workflow."""

    try:
        actor = request.user if request and request.user.is_authenticated else None
        return AuditLog.objects.create(
            actor=actor,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            hostel_id=hostel_id,
            details=details or {},
        )
    except (OperationalError, ProgrammingError):
        # This keeps an in-flight deployment usable before the new audit table
        # has been migrated. Once migration 0003 is applied, events persist.
        return None
