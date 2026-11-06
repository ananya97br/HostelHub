from datetime import date

from django.utils import timezone
from rest_framework import serializers

from .models import (
    AccountProfile,
    Allocation,
    AuditLog,
    Complaint,
    Hostel,
    Room,
    Staff,
    Student,
)
from .permissions import (
    assigned_hostel_ids,
    get_role,
    linked_student_id,
)


class AccountProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    is_active = serializers.BooleanField(source="user.is_active", read_only=True)
    student_name = serializers.SerializerMethodField()
    staff_name = serializers.SerializerMethodField()

    class Meta:
        model = AccountProfile
        fields = [
            "id",
            "username",
            "role",
            "student_id",
            "student_name",
            "staff_id",
            "staff_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        if not obj.student_id:
            return None
        return Student.objects.filter(student_id=obj.student_id).values_list(
            "name", flat=True
        ).first()

    def get_staff_name(self, obj):
        if not obj.staff_id:
            return None
        return Staff.objects.filter(staff_id=obj.staff_id).values_list(
            "name", flat=True
        ).first()


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            "event_id",
            "actor_username",
            "action",
            "resource_type",
            "resource_id",
            "hostel_id",
            "details",
            "created_at",
        ]
        read_only_fields = fields


class StudentSerializer(serializers.ModelSerializer):
    admission_date = serializers.DateField(required=False, default=date.today)

    class Meta:
        model = Student
        fields = [
            "student_id",
            "name",
            "gender",
            "date_of_birth",
            "department",
            "year_of_study",
            "contact_number",
            "email",
            "guardian_name",
            "guardian_contact",
            "special_requirements",
            "admission_date",
        ]
        read_only_fields = ["student_id"]

    def validate_gender(self, value):
        if value not in ["Male", "Female", "Other"]:
            raise serializers.ValidationError(
                "Gender must be Male, Female, or Other."
            )
        return value

    def validate_year_of_study(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError(
                "Year of study must be between 1 and 5."
            )
        return value

    def validate_date_of_birth(self, value):
        if value > date.today():
            raise serializers.ValidationError(
                "Date of birth cannot be in the future."
            )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if self.instance is not None and request is not None:
            if get_role(request.user) == AccountProfile.ROLE_STUDENT:
                allowed_fields = {
                    "contact_number",
                    "email",
                    "guardian_name",
                    "guardian_contact",
                    "special_requirements",
                }
                forbidden = set(attrs) - allowed_fields
                if forbidden:
                    raise serializers.ValidationError(
                        "Students may update contact and approved personal information only."
                    )
        return attrs


class HostelSerializer(serializers.ModelSerializer):
    warden_id = serializers.PrimaryKeyRelatedField(
        source="warden",
        queryset=Staff.objects.filter(role="Warden"),
        allow_null=True,
        required=False,
    )
    warden_name = serializers.CharField(
        source="warden.name", read_only=True, default=None
    )

    class Meta:
        model = Hostel
        fields = [
            "hostel_id",
            "hostel_name",
            "gender_type",
            "total_rooms",
            "warden_id",
            "warden_name",
            "hostel_address",
        ]

    def validate(self, attrs):
        if self.instance is not None and "total_rooms" in attrs:
            actual_rooms = Room.objects.filter(hostel_id=self.instance.hostel_id).count()
            if attrs["total_rooms"] < actual_rooms:
                raise serializers.ValidationError(
                    {"total_rooms": "Total rooms cannot be below the existing room count."}
                )
        if attrs.get("total_rooms", 1) < 1:
            raise serializers.ValidationError(
                {"total_rooms": "Total rooms must be at least one."}
            )
        return attrs


class RoomSerializer(serializers.ModelSerializer):
    vacant_seats = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    hostel_id = serializers.IntegerField(read_only=True)
    hostel_name = serializers.CharField(
        source="hostel.hostel_name", read_only=True
    )

    class Meta:
        model = Room
        fields = [
            "room_id",
            "hostel",
            "hostel_id",
            "hostel_name",
            "room_number",
            "floor_number",
            "room_type",
            "capacity",
            "current_occupancy",
            "vacant_seats",
            "status",
            "is_available",
            "rent_per_semester",
        ]
        read_only_fields = [
            "room_id",
            "hostel_id",
            "hostel_name",
            "current_occupancy",
            "vacant_seats",
            "is_available",
        ]

    STATUSES = {"Available", "Full", "Blocked", "Under Maintenance"}

    def validate_status(self, value):
        if value not in self.STATUSES:
            raise serializers.ValidationError("Invalid room status.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        role = get_role(request.user) if request else None
        if self.instance is not None and role == AccountProfile.ROLE_WARDEN:
            forbidden = set(attrs) - {"status"}
            if forbidden:
                raise serializers.ValidationError(
                    "Wardens may only update room maintenance status."
                )
        if self.instance is not None and role in {
            AccountProfile.ROLE_STUDENT,
            AccountProfile.ROLE_MAINTENANCE,
        }:
            raise serializers.ValidationError("This role cannot update room records.")

        capacity = attrs.get("capacity", self.instance.capacity if self.instance else None)
        if capacity is not None and capacity < 1:
            raise serializers.ValidationError({"capacity": "Capacity must be at least one."})
        if self.instance is not None and capacity is not None and capacity < self.instance.current_occupancy:
            raise serializers.ValidationError(
                {"capacity": "Capacity cannot be below current occupancy."}
            )
        if self.instance is not None and "hostel" in attrs:
            if attrs["hostel"].pk != self.instance.hostel_id and self.instance.current_occupancy:
                raise serializers.ValidationError(
                    "An occupied room cannot be moved to another hostel."
                )
        if attrs.get("status") == "Available" and self.instance is not None:
            if self.instance.current_occupancy >= capacity:
                raise serializers.ValidationError(
                    {"status": "A full room cannot be marked available."}
                )
        return attrs

    def create(self, validated_data):
        validated_data.setdefault("current_occupancy", 0)
        validated_data.setdefault("status", "Available")
        return super().create(validated_data)

    def get_vacant_seats(self, obj):
        return max(0, obj.capacity - obj.current_occupancy)

    def get_is_available(self, obj):
        return (
            str(obj.status).lower() == "available"
            and obj.current_occupancy < obj.capacity
        )


class StaffSerializer(serializers.ModelSerializer):
    hostel_name = serializers.CharField(
        source="hostel.hostel_name", read_only=True, default=None
    )

    class Meta:
        model = Staff
        fields = [
            "staff_id",
            "name",
            "role",
            "contact_number",
            "email",
            "hostel",
            "hostel_name",
        ]
        read_only_fields = ["staff_id", "hostel_name"]

    STAFF_ROLES = {"Admin", "Warden", "Maintenance", "Security"}

    def validate_role(self, value):
        if value not in self.STAFF_ROLES:
            raise serializers.ValidationError("Invalid staff role.")
        return value


class AllocationSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    hostel_id = serializers.IntegerField(source="room.hostel_id", read_only=True)
    hostel_name = serializers.CharField(
        source="room.hostel.hostel_name", read_only=True
    )

    class Meta:
        model = Allocation
        fields = [
            "allocation_id",
            "student",
            "student_name",
            "room",
            "room_number",
            "hostel_id",
            "hostel_name",
            "academic_year",
            "allocation_date",
            "vacate_date",
            "status",
            "allocated_by",
        ]
        read_only_fields = fields


class AllocationCreateSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(min_value=1)
    room_id = serializers.IntegerField(min_value=1)
    academic_year = serializers.RegexField(regex=r"^\d{4}-\d{4}$", max_length=9)

    def validate_academic_year(self, value):
        start_year, end_year = map(int, value.split("-"))
        if end_year != start_year + 1:
            raise serializers.ValidationError(
                "Academic year must contain consecutive years."
            )
        return value


class RoomVacationSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(min_value=1)


class RoomReassignmentSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(min_value=1)
    new_room_id = serializers.IntegerField(min_value=1)


class ComplaintSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    hostel_id = serializers.IntegerField(source="room.hostel_id", read_only=True)
    hostel_name = serializers.CharField(
        source="room.hostel.hostel_name", read_only=True
    )
    assigned_staff_name = serializers.CharField(
        source="assigned_to.name", read_only=True, default=None
    )

    COMPLAINT_TYPES = {
        "Electrical",
        "Plumbing",
        "Furniture",
        "Cleanliness",
        "Roommate Issue",
        "Security",
        "Other",
    }
    STATUSES = {"Open", "In-Progress", "Completed", "Resolved", "Rejected"}
    PRIORITIES = {"Low", "Medium", "High", "Urgent"}
    TRANSITIONS = {
        "Open": {"Open", "In-Progress", "Rejected"},
        "In-Progress": {"Open", "In-Progress", "Completed", "Resolved", "Rejected"},
        "Completed": {"In-Progress", "Completed", "Resolved"},
        "Resolved": {"Open", "In-Progress", "Resolved"},
        "Rejected": {"Open", "Rejected"},
    }

    class Meta:
        model = Complaint
        fields = [
            "complaint_id",
            "student",
            "student_name",
            "room",
            "room_number",
            "hostel_id",
            "hostel_name",
            "complaint_type",
            "description",
            "date_filed",
            "priority",
            "status",
            "assigned_to",
            "assigned_staff_name",
            "resolution_date",
            "resolution_remarks",
            "updated_at",
        ]
        read_only_fields = [
            "complaint_id",
            "student_name",
            "room_number",
            "hostel_id",
            "hostel_name",
            "date_filed",
            "resolution_date",
            "updated_at",
        ]
        extra_kwargs = {
            "student": {"required": False},
            "room": {"required": False},
            "complaint_type": {"required": True},
            "description": {"required": True},
            "status": {"required": False},
            "priority": {"required": False},
            "assigned_to": {"required": False, "allow_null": True},
            "resolution_remarks": {"required": False, "allow_blank": True},
        }

    def _request_role(self):
        request = self.context.get("request")
        return get_role(request.user) if request else None

    def validate_complaint_type(self, value):
        if value not in self.COMPLAINT_TYPES:
            raise serializers.ValidationError("Invalid complaint category.")
        return value

    def validate_priority(self, value):
        if value not in self.PRIORITIES:
            raise serializers.ValidationError("Invalid complaint priority.")
        return value

    def validate_status(self, value):
        if value not in self.STATUSES:
            raise serializers.ValidationError("Invalid complaint status.")
        return value

    def validate_description(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Complaint description cannot be empty.")
        if len(value) > 1000:
            raise serializers.ValidationError("Description cannot exceed 1000 characters.")
        return value

    def validate_resolution_remarks(self, value):
        if value is None:
            return value
        value = value.strip()
        if len(value) > 500:
            raise serializers.ValidationError("Resolution remarks cannot exceed 500 characters.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        role = self._request_role()
        if request is None or role is None:
            raise serializers.ValidationError("A valid DormDesk account is required.")

        instance = self.instance
        if instance is not None:
            if role == AccountProfile.ROLE_STUDENT:
                raise serializers.ValidationError(
                    "Students can view complaint status but cannot edit complaints."
                )

            if "student" in attrs and attrs["student"].pk != instance.student_id:
                raise serializers.ValidationError(
                    {"student": "The complaint owner cannot be changed."}
                )
            if "room" in attrs and attrs["room"].pk != instance.room_id:
                raise serializers.ValidationError(
                    {"room": "The complaint room cannot be changed."}
                )

            if role == AccountProfile.ROLE_MAINTENANCE:
                forbidden = set(attrs) - {"status", "resolution_remarks"}
                if forbidden:
                    raise serializers.ValidationError(
                        "Maintenance staff may only update status and resolution remarks."
                    )

            student = instance.student
            room = instance.room
        else:
            student = attrs.get("student")
            room = attrs.get("room")

            if role == AccountProfile.ROLE_STUDENT:
                own_student_id = linked_student_id(request.user)
                if not own_student_id:
                    raise serializers.ValidationError(
                        "This account is not linked to a student record."
                    )
                if student is not None and student.student_id != own_student_id:
                    raise serializers.ValidationError(
                        {"student": "Students cannot submit for another student."}
                    )

                student = Student.objects.filter(student_id=own_student_id).first()
                active_allocations = list(
                    Allocation.objects.filter(
                        student_id=own_student_id, status="Allocated"
                    ).select_related("room")[:2]
                )
                if len(active_allocations) != 1:
                    raise serializers.ValidationError(
                        "A student must have exactly one active allocation to submit a complaint."
                    )
                allocated_room = active_allocations[0].room
                if room is not None and room.room_id != allocated_room.room_id:
                    raise serializers.ValidationError(
                        {"room": "A complaint must belong to your current room."}
                    )
                room = allocated_room
                attrs["student"] = student
                attrs["room"] = room
                forbidden = set(attrs) & {
                    "status",
                    "priority",
                    "assigned_to",
                    "resolution_remarks",
                }
                if forbidden:
                    raise serializers.ValidationError(
                        "Students may only submit complaint details; workflow fields are managed by staff."
                    )
            elif role not in {
                AccountProfile.ROLE_ADMIN,
                AccountProfile.ROLE_WARDEN,
            }:
                raise serializers.ValidationError(
                    "This role cannot submit complaints on behalf of a student."
                )

            if student is None or room is None:
                raise serializers.ValidationError(
                    {"room": "An active student-room allocation is required."}
                )

            if not Allocation.objects.filter(
                student=student, room=room, status="Allocated"
            ).exists():
                raise serializers.ValidationError(
                    {"room": "Student must have an active allocation for this room."}
                )

            if role == AccountProfile.ROLE_WARDEN and room.hostel_id not in assigned_hostel_ids(
                request.user
            ):
                raise serializers.ValidationError(
                    "You may only manage complaints for your assigned hostels."
                )

        assigned_to = attrs.get(
            "assigned_to", instance.assigned_to if instance else None
        )
        if assigned_to is not None:
            if "assigned_to" in attrs and assigned_to.role != "Maintenance":
                raise serializers.ValidationError(
                    {"assigned_to": "Complaints can only be assigned to maintenance staff."}
                )
            if role == AccountProfile.ROLE_WARDEN:
                allowed_hostels = assigned_hostel_ids(request.user)
                if assigned_to.hostel_id and assigned_to.hostel_id not in allowed_hostels:
                    raise serializers.ValidationError(
                        {"assigned_to": "That staff member is outside your hostels."}
                    )

        new_status = attrs.get("status", instance.status if instance else "Open")
        if instance and new_status not in self.TRANSITIONS.get(instance.status, {new_status}):
            raise serializers.ValidationError(
                {"status": f"Cannot change a {instance.status} complaint to {new_status}."}
            )

        if role == AccountProfile.ROLE_MAINTENANCE and new_status not in {
            "Open",
            "In-Progress",
            "Completed",
        }:
            raise serializers.ValidationError(
                {"status": "Maintenance staff can update work to Open, In-Progress, or Completed; a warden or administrator must finalize it."}
            )

        if new_status in {"Completed", "Resolved", "Rejected"}:
            remarks = attrs.get(
                "resolution_remarks",
                instance.resolution_remarks if instance else None,
            )
            if not remarks or not remarks.strip():
                raise serializers.ValidationError(
                    {"resolution_remarks": "Remarks are required when resolving or rejecting a complaint."}
                )

        return attrs

    def create(self, validated_data):
        now = timezone.now()
        if self._request_role() == AccountProfile.ROLE_STUDENT:
            # Never trust workflow fields from a student request, even if a
            # future client accidentally includes them.
            validated_data["status"] = "Open"
            validated_data["priority"] = "Medium"
            validated_data["assigned_to"] = None
            validated_data["resolution_remarks"] = None
        else:
            validated_data.setdefault("status", "Open")
            validated_data.setdefault("priority", "Medium")
            validated_data.setdefault("resolution_remarks", None)
        if validated_data.get("status") == "Resolved":
            validated_data["resolution_date"] = timezone.localdate()
        validated_data.setdefault("date_filed", timezone.localdate())
        validated_data.setdefault("updated_at", now)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        new_status = validated_data.get("status", instance.status)
        if new_status == "Resolved":
            if instance.status != "Resolved":
                instance.resolution_date = timezone.localdate()
        else:
            instance.resolution_date = None
            if new_status in {"Open", "In-Progress"} and self._request_role() != AccountProfile.ROLE_MAINTENANCE:
                validated_data["resolution_remarks"] = None

        instance.updated_at = timezone.now()
        return super().update(instance, validated_data)
