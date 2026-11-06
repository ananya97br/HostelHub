# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models
from django.conf import settings


class Staff(models.Model):
    staff_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=20)
    contact_number = models.CharField(unique=True, max_length=15)
    email = models.CharField(unique=True, max_length=100, blank=True, null=True)
    hostel = models.ForeignKey('Hostel', models.DB_SET_NULL, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'Staff'


class Hostel(models.Model):
    hostel_id = models.AutoField(primary_key=True)
    hostel_name = models.CharField(unique=True, max_length=100)
    gender_type = models.CharField(max_length=10)
    total_rooms = models.IntegerField()
    warden = models.ForeignKey(Staff, models.DB_SET_NULL, blank=True, null=True, related_name='managed_hostels')
    hostel_address = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'Hostel'


class Room(models.Model):
    room_id = models.AutoField(primary_key=True)
    hostel = models.ForeignKey(Hostel, models.DB_CASCADE)
    room_number = models.CharField(max_length=10)
    floor_number = models.IntegerField()
    room_type = models.CharField(max_length=20)
    capacity = models.IntegerField()
    current_occupancy = models.IntegerField()
    status = models.CharField(max_length=20)
    rent_per_semester = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        managed = False
        db_table = 'Room'
        unique_together = (('hostel', 'room_number'),)


class Student(models.Model):
    student_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10)
    date_of_birth = models.DateField()
    department = models.CharField(max_length=50)
    year_of_study = models.IntegerField()
    contact_number = models.CharField(unique=True, max_length=15)
    email = models.CharField(unique=True, max_length=100)
    guardian_name = models.CharField(max_length=100, blank=True, null=True)
    guardian_contact = models.CharField(max_length=15, blank=True, null=True)
    special_requirements = models.CharField(max_length=200, blank=True, null=True)
    admission_date = models.DateField()

    class Meta:
        managed = False
        db_table = 'Student'


class Preference(models.Model):
    preference_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, models.DB_CASCADE)
    preferred_hostel = models.ForeignKey(Hostel, models.DB_SET_NULL, blank=True, null=True)
    preferred_room_type = models.CharField(max_length=20, blank=True, null=True)
    preferred_floor = models.IntegerField(blank=True, null=True)
    priority_rank = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'Preference'


class Allocation(models.Model):
    allocation_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, models.DB_CASCADE)
    room = models.ForeignKey(Room, models.DB_CASCADE)
    academic_year = models.CharField(max_length=9)
    allocation_date = models.DateField()
    vacate_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20)
    allocated_by = models.ForeignKey(Staff, models.DB_SET_NULL, db_column='allocated_by', blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'Allocation'


class Complaint(models.Model):
    complaint_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, models.DO_NOTHING)
    room = models.ForeignKey(Room, models.DO_NOTHING)
    complaint_type = models.CharField(max_length=30)
    description = models.CharField(max_length=1000)
    date_filed = models.DateField()
    priority = models.CharField(max_length=10)
    status = models.CharField(max_length=20)
    assigned_to = models.ForeignKey(Staff, models.DB_SET_NULL, db_column='assigned_to', blank=True, null=True)
    resolution_date = models.DateField(blank=True, null=True)
    resolution_remarks = models.CharField(max_length=500, blank=True, null=True)
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'Complaint'


class ComplaintVectorOutbox(models.Model):
    event_id = models.BigAutoField(primary_key=True)
    complaint_id = models.IntegerField()
    operation = models.CharField(max_length=6)
    sync_status = models.CharField(max_length=10)
    attempts = models.IntegerField()
    created_at = models.DateTimeField()
    processed_at = models.DateTimeField(blank=True, null=True)
    last_error = models.CharField(max_length=1000, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'Complaint_Vector_Outbox'


class AccountProfile(models.Model):
    """Explicitly links a Django login to a DormDesk identity.

    The operational tables in this app are legacy, unmanaged tables.  Keeping
    the link in a small managed table avoids relying on matching primary-key
    values between ``auth_user`` and Student/Staff records.
    """

    ROLE_ADMIN = "Admin"
    ROLE_WARDEN = "Warden"
    ROLE_MAINTENANCE = "Maintenance"
    ROLE_STUDENT = "Student"

    ROLE_CHOICES = (
        (ROLE_ADMIN, ROLE_ADMIN),
        (ROLE_WARDEN, ROLE_WARDEN),
        (ROLE_MAINTENANCE, ROLE_MAINTENANCE),
        (ROLE_STUDENT, ROLE_STUDENT),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="dorm_profile",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    # These are deliberately IDs rather than ForeignKeys.  The referenced
    # legacy tables use database-level delete actions and are unmanaged; an
    # ORM relation here would either fail Django's model checks or add a
    # constraint to a table we do not own.
    student_id = models.PositiveIntegerField(blank=True, null=True, unique=True)
    staff_id = models.PositiveIntegerField(blank=True, null=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "core_accountprofile"

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class AuditLog(models.Model):
    """Append-only record of privileged and workflow changes."""

    event_id = models.BigAutoField(primary_key=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dorm_audit_events",
    )
    action = models.CharField(max_length=80)
    resource_type = models.CharField(max_length=40)
    resource_id = models.PositiveIntegerField(null=True, blank=True)
    hostel_id = models.PositiveIntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_auditlog"
        ordering = ["-created_at", "-event_id"]
