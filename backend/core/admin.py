from django.contrib import admin

from .models import (
    AccountProfile,
    AuditLog,
    Student,
    Staff,
    Hostel,
    Room,
    Preference,
    Allocation,
    Complaint,
    ComplaintVectorOutbox,
)


admin.site.register(Student)
admin.site.register(Staff)
admin.site.register(Hostel)
admin.site.register(Room)
admin.site.register(Preference)
admin.site.register(Allocation)
admin.site.register(Complaint)
admin.site.register(ComplaintVectorOutbox)


@admin.register(AccountProfile)
class AccountProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "student_id", "staff_id", "updated_at")
    list_filter = ("role",)
    search_fields = ("user__username", "student_id", "staff_id")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "resource_type", "resource_id", "hostel_id")
    list_filter = ("action", "resource_type")
    search_fields = ("actor__username", "resource_type", "action")
    readonly_fields = tuple(field.name for field in AuditLog._meta.fields)
