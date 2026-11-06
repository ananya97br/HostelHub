from __future__ import annotations

from datetime import date

from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import F, Q
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AccountProfile,
    Allocation,
    Complaint,
    Hostel,
    Room,
    Staff,
    Student,
    AuditLog,
)
from .audit import record_audit
from .permissions import (
    AdminOrWardenPermission,
    AdminOrStudentPermission,
    AdminPermission,
    AnyDormUserPermission,
    StaffPermission,
    assigned_hostel_ids,
    get_profile,
    get_role,
    linked_staff_id,
    linked_student_id,
)
from .semantic import search_similar_complaints
from .serializers import (
    AllocationCreateSerializer,
    AllocationSerializer,
    AccountProfileSerializer,
    AuditLogSerializer,
    ComplaintSerializer,
    HostelSerializer,
    RoomReassignmentSerializer,
    RoomSerializer,
    RoomVacationSerializer,
    StaffSerializer,
    StudentSerializer,
)
from .services import allocate_room, reassign_room, vacate_room


def _is_admin(user) -> bool:
    return get_role(user) == AccountProfile.ROLE_ADMIN


def _staff_hostel_filter(queryset, user, field_name: str):
    hostels = assigned_hostel_ids(user)
    if not hostels:
        return queryset.none()
    return queryset.filter(**{f"{field_name}__in": hostels})


def scoped_rooms(user, include_available=False):
    queryset = Room.objects.select_related("hostel").order_by("room_id")
    role = get_role(user)
    if role == AccountProfile.ROLE_ADMIN:
        return queryset
    if role == AccountProfile.ROLE_WARDEN:
        return _staff_hostel_filter(queryset, user, "hostel_id")
    if role == AccountProfile.ROLE_STUDENT:
        student_id = linked_student_id(user)
        if not student_id:
            return queryset.none()
        own_room_ids = Allocation.objects.filter(
            student_id=student_id, status="Allocated"
        ).values("room_id")
        if include_available:
            return queryset.filter(
                Q(room_id__in=own_room_ids)
                | Q(status="Available", current_occupancy__lt=F("capacity"))
            ).distinct()
        return queryset.filter(room_id__in=own_room_ids)
    if role == AccountProfile.ROLE_MAINTENANCE:
        staff_id = linked_staff_id(user)
        if not staff_id:
            return queryset.none()
        assigned_room_ids = Complaint.objects.filter(
            assigned_to_id=staff_id
        ).values("room_id")
        return queryset.filter(room_id__in=assigned_room_ids).distinct()
    return queryset.none()


def scoped_complaints(user):
    queryset = Complaint.objects.select_related(
        "student", "room", "room__hostel", "assigned_to"
    ).order_by("-complaint_id")
    role = get_role(user)

    if role == AccountProfile.ROLE_ADMIN:
        return queryset
    if role == AccountProfile.ROLE_STUDENT:
        student_id = linked_student_id(user)
        return queryset.filter(student_id=student_id) if student_id else queryset.none()
    if role == AccountProfile.ROLE_WARDEN:
        return _staff_hostel_filter(queryset, user, "room__hostel_id")
    if role == AccountProfile.ROLE_MAINTENANCE:
        staff_id = linked_staff_id(user)
        return queryset.filter(assigned_to_id=staff_id) if staff_id else queryset.none()
    return queryset.none()


def scoped_hostels(user):
    queryset = Hostel.objects.select_related("warden").order_by("hostel_id")
    role = get_role(user)
    if role == AccountProfile.ROLE_ADMIN:
        return queryset
    if role == AccountProfile.ROLE_WARDEN:
        return queryset.filter(hostel_id__in=assigned_hostel_ids(user))
    if role == AccountProfile.ROLE_STUDENT:
        # Hostel identity and address are public accommodation information.
        return queryset
    if role == AccountProfile.ROLE_MAINTENANCE:
        staff_id = linked_staff_id(user)
        if not staff_id:
            return queryset.none()
        assigned_hostel_ids_for_work = Complaint.objects.filter(
            assigned_to_id=staff_id
        ).values("room__hostel_id")
        return queryset.filter(hostel_id__in=assigned_hostel_ids_for_work).distinct()
    return queryset.none()


def scoped_allocations(user):
    queryset = Allocation.objects.select_related(
        "student", "room", "room__hostel"
    ).order_by("-allocation_id")
    role = get_role(user)
    if role == AccountProfile.ROLE_ADMIN:
        return queryset
    if role == AccountProfile.ROLE_STUDENT:
        student_id = linked_student_id(user)
        return queryset.filter(student_id=student_id) if student_id else queryset.none()
    if role == AccountProfile.ROLE_WARDEN:
        return _staff_hostel_filter(queryset, user, "room__hostel_id")
    # Maintenance staff receive work through complaints, not accommodation data.
    return queryset.none()


class StudentListCreateView(generics.ListCreateAPIView):
    serializer_class = StudentSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        queryset = Student.objects.all().order_by("student_id")
        role = get_role(self.request.user)
        if role == AccountProfile.ROLE_ADMIN:
            return queryset
        if role == AccountProfile.ROLE_STUDENT:
            student_id = linked_student_id(self.request.user)
            return queryset.filter(student_id=student_id) if student_id else queryset.none()
        if role == AccountProfile.ROLE_WARDEN:
            hostels = assigned_hostel_ids(self.request.user)
            return queryset.filter(
                allocation__room__hostel_id__in=hostels,
                allocation__status="Allocated",
            ).distinct()
        return queryset.none()

    def perform_create(self, serializer):
        student = serializer.save()
        record_audit(
            self.request,
            action="student.created",
            resource_type="Student",
            resource_id=student.student_id,
        )


class StudentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StudentSerializer
    lookup_field = "student_id"

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [AdminOrStudentPermission()]
        if self.request.method == "PUT":
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        return StudentListCreateView.get_queryset(self)

    def perform_update(self, serializer):
        student = serializer.save()
        record_audit(
            self.request,
            action="student.updated",
            resource_type="Student",
            resource_id=student.student_id,
        )


class HostelListView(generics.ListCreateAPIView):
    serializer_class = HostelSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        return scoped_hostels(self.request.user)

    def perform_create(self, serializer):
        hostel = serializer.save()
        record_audit(
            self.request,
            action="hostel.created",
            resource_type="Hostel",
            resource_id=hostel.hostel_id,
            hostel_id=hostel.hostel_id,
        )


class HostelDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = HostelSerializer
    lookup_field = "hostel_id"

    def get_permissions(self):
        if self.request.method in {"PATCH", "PUT", "DELETE"}:
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        return HostelListView.get_queryset(self)

    def perform_destroy(self, instance):
        if Room.objects.filter(hostel_id=instance.hostel_id).exists():
            raise ValidationError("A hostel with rooms cannot be deleted.")
        instance.delete()
        record_audit(
            self.request,
            action="hostel.deleted",
            resource_type="Hostel",
            resource_id=instance.hostel_id,
            hostel_id=instance.hostel_id,
        )

    def perform_update(self, serializer):
        hostel = serializer.save()
        record_audit(
            self.request,
            action="hostel.updated",
            resource_type="Hostel",
            resource_id=hostel.hostel_id,
            hostel_id=hostel.hostel_id,
        )


class RoomListView(generics.ListCreateAPIView):
    serializer_class = RoomSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        queryset = scoped_rooms(
            self.request.user,
            include_available=(
                get_role(self.request.user) == AccountProfile.ROLE_STUDENT
                and self.request.query_params.get("available_only") == "true"
            ),
        )

        hostel_id = self.request.query_params.get("hostel_id")
        room_type = self.request.query_params.get("room_type")
        available_only = self.request.query_params.get("available_only")

        if hostel_id:
            try:
                hostel_id = int(hostel_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"hostel_id": "Must be a valid integer."}) from exc
            queryset = queryset.filter(hostel_id=hostel_id)

        if room_type:
            queryset = queryset.filter(room_type=room_type)

        if available_only is not None:
            if available_only.lower() not in ("true", "false"):
                raise ValidationError({"available_only": "Use true or false."})
            if available_only.lower() == "true":
                queryset = queryset.filter(
                    status="Available", current_occupancy__lt=F("capacity")
                )

        return queryset

    def perform_create(self, serializer):
        room = serializer.save()
        record_audit(
            self.request,
            action="room.created",
            resource_type="Room",
            resource_id=room.room_id,
            hostel_id=room.hostel_id,
        )


class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RoomSerializer
    lookup_field = "room_id"

    def get_permissions(self):
        if self.request.method in {"PATCH", "PUT"}:
            return [AdminOrWardenPermission()]
        if self.request.method == "DELETE":
            return [AdminPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        return scoped_rooms(self.request.user)

    def perform_destroy(self, instance):
        if Allocation.objects.filter(room_id=instance.room_id).exists():
            raise ValidationError("A room with allocation history cannot be deleted.")
        if Complaint.objects.filter(room_id=instance.room_id).exists():
            raise ValidationError("A room with complaint history cannot be deleted.")
        hostel_id = instance.hostel_id
        room_id = instance.room_id
        instance.delete()
        record_audit(
            self.request,
            action="room.deleted",
            resource_type="Room",
            resource_id=room_id,
            hostel_id=hostel_id,
        )

    def perform_update(self, serializer):
        room = serializer.save()
        record_audit(
            self.request,
            action="room.updated",
            resource_type="Room",
            resource_id=room.room_id,
            hostel_id=room.hostel_id,
        )


class StaffListView(generics.ListCreateAPIView):
    serializer_class = StaffSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AdminPermission()]
        return [StaffPermission()]

    def get_queryset(self):
        queryset = Staff.objects.select_related("hostel").order_by("name", "staff_id")
        if _is_admin(self.request.user):
            return queryset

        if get_role(self.request.user) == AccountProfile.ROLE_MAINTENANCE:
            return queryset.filter(staff_id=linked_staff_id(self.request.user))

        hostels = assigned_hostel_ids(self.request.user)
        return queryset.filter(
            Q(hostel_id__in=hostels) | Q(role="Maintenance", hostel__isnull=True)
        )

    def perform_create(self, serializer):
        staff = serializer.save()
        record_audit(
            self.request,
            action="staff.created",
            resource_type="Staff",
            resource_id=staff.staff_id,
            hostel_id=staff.hostel_id,
        )


class StaffDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StaffSerializer
    lookup_field = "staff_id"

    def get_permissions(self):
        if self.request.method in {"PUT", "PATCH"}:
            return [AdminPermission()]
        return [StaffPermission()]

    def get_queryset(self):
        return StaffListView.get_queryset(self)

    def perform_update(self, serializer):
        staff = serializer.save()
        record_audit(
            self.request,
            action="staff.updated",
            resource_type="Staff",
            resource_id=staff.staff_id,
            hostel_id=staff.hostel_id,
        )


class AllocationListView(generics.ListAPIView):
    serializer_class = AllocationSerializer
    permission_classes = [AnyDormUserPermission]

    def get_queryset(self):
        return scoped_allocations(self.request.user)


def _ensure_staff_room_scope(request, student_id: int, room_id: int | None = None):
    if get_role(request.user) != AccountProfile.ROLE_WARDEN:
        return

    hostels = assigned_hostel_ids(request.user)
    if room_id is not None and not Room.objects.filter(
        room_id=room_id, hostel_id__in=hostels
    ).exists():
        raise ValidationError("The requested room is outside your assigned hostels.")

    active = Allocation.objects.filter(student_id=student_id, status="Allocated")
    if active.exists() and not active.filter(room__hostel_id__in=hostels).exists():
        raise ValidationError("This student is outside your assigned hostels.")


class AllocationCreateView(APIView):
    permission_classes = [AdminOrWardenPermission]

    def post(self, request):
        serializer = AllocationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data["student_id"]
        room_id = serializer.validated_data["room_id"]
        _ensure_staff_room_scope(request, student_id, room_id)

        allocation = allocate_room(
            student_id=student_id,
            room_id=room_id,
            academic_year=serializer.validated_data["academic_year"],
            allocated_by_id=linked_staff_id(request.user),
        )
        record_audit(
            request,
            action="allocation.created",
            resource_type="Allocation",
            resource_id=allocation.allocation_id,
            hostel_id=allocation.room.hostel_id,
            details={"student_id": allocation.student_id, "room_id": allocation.room_id},
        )
        return Response(AllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)


class RoomVacationView(APIView):
    permission_classes = [AdminOrWardenPermission]

    def post(self, request):
        serializer = RoomVacationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data["student_id"]
        _ensure_staff_room_scope(request, student_id)
        allocation = vacate_room(student_id=student_id)
        record_audit(
            request,
            action="allocation.vacated",
            resource_type="Allocation",
            resource_id=allocation.allocation_id,
            hostel_id=allocation.room.hostel_id,
            details={"student_id": allocation.student_id, "room_id": allocation.room_id},
        )
        return Response(
            {
                "message": "Room vacated successfully.",
                "allocation": AllocationSerializer(allocation).data,
            }
        )


class RoomReassignmentView(APIView):
    permission_classes = [AdminOrWardenPermission]

    def post(self, request):
        serializer = RoomReassignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data["student_id"]
        new_room_id = serializer.validated_data["new_room_id"]
        _ensure_staff_room_scope(request, student_id)
        _ensure_staff_room_scope(request, student_id, new_room_id)
        allocation = reassign_room(
            student_id=student_id,
            new_room_id=new_room_id,
            allocated_by_id=linked_staff_id(request.user),
        )
        record_audit(
            request,
            action="allocation.reassigned",
            resource_type="Allocation",
            resource_id=allocation.allocation_id,
            hostel_id=allocation.room.hostel_id,
            details={"student_id": allocation.student_id, "room_id": allocation.room_id},
        )
        return Response(
            {
                "message": "Room reassigned successfully.",
                "allocation": AllocationSerializer(allocation).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ComplaintListCreateView(generics.ListCreateAPIView):
    serializer_class = ComplaintSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [AnyDormUserPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        queryset = scoped_complaints(self.request.user)
        status_value = self.request.query_params.get("status")
        priority = self.request.query_params.get("priority")
        complaint_type = self.request.query_params.get("type")
        student_id = self.request.query_params.get("student_id")
        hostel_id = self.request.query_params.get("hostel_id")
        assigned_to = self.request.query_params.get("assigned_to")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if status_value:
            if status_value not in ComplaintSerializer.STATUSES:
                raise ValidationError({"status": "Invalid complaint status."})
            queryset = queryset.filter(status=status_value)
        if priority:
            if priority not in ComplaintSerializer.PRIORITIES:
                raise ValidationError({"priority": "Invalid complaint priority."})
            queryset = queryset.filter(priority=priority)
        if complaint_type:
            if complaint_type not in ComplaintSerializer.COMPLAINT_TYPES:
                raise ValidationError({"type": "Invalid complaint category."})
            queryset = queryset.filter(complaint_type=complaint_type)
        if student_id:
            try:
                student_id = int(student_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"student_id": "Must be a valid integer."}) from exc
            queryset = queryset.filter(student_id=student_id)
        if hostel_id:
            try:
                hostel_id = int(hostel_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"hostel_id": "Must be a valid integer."}) from exc
            queryset = queryset.filter(room__hostel_id=hostel_id)
        if assigned_to:
            try:
                assigned_to = int(assigned_to)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"assigned_to": "Must be a valid integer."}) from exc
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if date_from:
            try:
                parsed_date_from = date.fromisoformat(date_from)
            except ValueError as exc:
                raise ValidationError({"date_from": "Use YYYY-MM-DD."}) from exc
            queryset = queryset.filter(date_filed__gte=parsed_date_from)
        if date_to:
            try:
                parsed_date_to = date.fromisoformat(date_to)
            except ValueError as exc:
                raise ValidationError({"date_to": "Use YYYY-MM-DD."}) from exc
            queryset = queryset.filter(date_filed__lte=parsed_date_to)
        return queryset

    def perform_create(self, serializer):
        complaint = serializer.save()
        record_audit(
            self.request,
            action="complaint.created",
            resource_type="Complaint",
            resource_id=complaint.complaint_id,
            hostel_id=complaint.room.hostel_id,
            details={"status": complaint.status, "priority": complaint.priority},
        )


class ComplaintDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ComplaintSerializer
    lookup_field = "complaint_id"
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [StaffPermission()]
        return [AnyDormUserPermission()]

    def get_queryset(self):
        return scoped_complaints(self.request.user)

    def perform_update(self, serializer):
        complaint = serializer.save()
        record_audit(
            self.request,
            action="complaint.updated",
            resource_type="Complaint",
            resource_id=complaint.complaint_id,
            hostel_id=complaint.room.hostel_id,
            details={"status": complaint.status, "priority": complaint.priority},
        )


@api_view(["GET"])
@permission_classes([AnyDormUserPermission])
def semantic_complaint_search(request):
    query = request.query_params.get("q", "").strip()
    if not query:
        return Response({"error": "Search query is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(query) > 500:
        return Response({"error": "Search query is too long."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Fetch more candidates than displayed so the subsequent MySQL scope
        # filter does not leak records or turn a narrow search into a false
        # empty result.
        matches = search_similar_complaints(query, limit=100)
    except Exception:
        return Response(
            {"error": "Semantic search is temporarily unavailable."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    complaint_ids = [int(match.id) for match in matches]
    complaints = scoped_complaints(request.user).filter(complaint_id__in=complaint_ids)
    complaint_map = {complaint.complaint_id: complaint for complaint in complaints}
    results = []
    for match in matches:
        complaint = complaint_map.get(int(match.id))
        if complaint is None:
            continue
        results.append(
            {
                "complaint_id": complaint.complaint_id,
                "student": complaint.student_id,
                "student_name": complaint.student.name,
                "room": complaint.room_id,
                "room_number": complaint.room.room_number,
                "hostel_id": complaint.room.hostel_id,
                "hostel_name": complaint.room.hostel.hostel_name,
                "complaint_type": complaint.complaint_type,
                "description": complaint.description,
                "status": complaint.status,
                "priority": complaint.priority,
                "assigned_to": complaint.assigned_to_id,
                "assigned_staff_name": complaint.assigned_to.name
                if complaint.assigned_to
                else None,
                "resolution_date": complaint.resolution_date,
                "resolution_remarks": complaint.resolution_remarks,
                "similarity_score": round(float(match.score), 4),
            }
        )
        if len(results) >= 20:
            break

    return Response({"query": query, "total_results": len(results), "results": results})


class AuthMeView(APIView):
    permission_classes = [AnyDormUserPermission]

    def get(self, request):
        profile = get_profile(request.user)
        return Response(
            {
                "username": request.user.username,
                "role": get_role(request.user),
                "is_admin": _is_admin(request.user),
                "student_id": profile.student_id if profile else None,
                "staff_id": profile.staff_id if profile else None,
            }
        )


class ProfileView(APIView):
    permission_classes = [AnyDormUserPermission]

    def _response_data(self, request):
        profile = get_profile(request.user)
        role = get_role(request.user)
        data = {
            "username": request.user.username,
            "role": role,
            "student_id": profile.student_id if profile else None,
            "staff_id": profile.staff_id if profile else None,
            "student": None,
            "staff": None,
            "current_allocation": None,
        }
        if role == AccountProfile.ROLE_STUDENT and profile:
            student = Student.objects.filter(student_id=profile.student_id).first()
            data["student"] = StudentSerializer(student).data if student else None
            allocation = scoped_allocations(request.user).filter(status="Allocated").first()
            if allocation:
                data["current_allocation"] = AllocationSerializer(allocation).data
        elif role in {
            AccountProfile.ROLE_WARDEN,
            AccountProfile.ROLE_MAINTENANCE,
        } and profile:
            staff = Staff.objects.select_related("hostel").filter(
                staff_id=profile.staff_id
            ).first()
            data["staff"] = StaffSerializer(staff).data if staff else None
        return data

    def get(self, request):
        return Response(self._response_data(request))

    def patch(self, request):
        profile = get_profile(request.user)
        role = get_role(request.user)
        password = request.data.get("password")
        if password is not None:
            if not isinstance(password, str) or len(password) < 8:
                raise ValidationError(
                    {"password": "Password must be at least 8 characters."}
                )

        account_fields = {"password"}
        supplied_fields = set(request.data)
        if role != AccountProfile.ROLE_STUDENT and supplied_fields - account_fields:
            raise ValidationError(
                "Only students may update personal profile fields."
            )
        if role == AccountProfile.ROLE_STUDENT:
            if profile is None or not profile.student_id:
                raise ValidationError("This account is not linked to a student record.")
            student = Student.objects.filter(student_id=profile.student_id).first()
            if student is None:
                raise ValidationError("The linked student record does not exist.")
            student_payload = {
                key: value
                for key, value in request.data.items()
                if key != "password"
            }
            serializer = StudentSerializer(
                student,
                data=student_payload,
                partial=True,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
        if password:
            request.user.set_password(password)
            request.user.save(update_fields=["password"])
        record_audit(
            request,
            action="profile.updated",
            resource_type="Profile",
            resource_id=(
                profile.student_id
                if profile and profile.student_id
                else profile.staff_id
                if profile
                else None
            ),
        )
        return Response(self._response_data(request))


class LogoutView(APIView):
    permission_classes = [AnyDormUserPermission]

    def post(self, request):
        if isinstance(request.auth, Token):
            request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DashboardSummaryView(APIView):
    permission_classes = [AnyDormUserPermission]

    def get(self, request):
        rooms = list(scoped_rooms(request.user))
        complaints = scoped_complaints(request.user)
        role = get_role(request.user)
        capacity = sum(int(room.capacity) for room in rooms)
        occupied = sum(int(room.current_occupancy) for room in rooms)
        available_beds = sum(
            max(0, int(room.capacity) - int(room.current_occupancy))
            for room in rooms
            if str(room.status).lower() == "available"
        )
        summary = {
            "role": role,
            "total_students": 0,
            "total_complaints": complaints.count(),
            "open_complaints": complaints.filter(
                status__in=["Open", "In-Progress"]
            ).count(),
            "completed_complaints": complaints.filter(status="Completed").count(),
            "in_progress_complaints": complaints.filter(status="In-Progress").count(),
            "resolved_complaints": complaints.filter(status="Resolved").count(),
            "urgent_complaints": complaints.filter(priority="Urgent").count(),
            "total_rooms": len(rooms),
            "total_capacity": capacity,
            "occupied_beds": occupied,
            "available_beds": available_beds,
            "available_rooms": sum(
                1
                for room in rooms
                if str(room.status).lower() == "available"
                and room.current_occupancy < room.capacity
            ),
            "full_rooms": sum(
                1 for room in rooms if str(room.status).lower() == "full"
            ),
            "hostels": len({room.hostel_id for room in rooms}),
        }
        if role == AccountProfile.ROLE_ADMIN:
            summary["total_students"] = Student.objects.count()
        elif role == AccountProfile.ROLE_WARDEN:
            summary["total_students"] = Student.objects.filter(
                allocation__room__hostel_id__in=assigned_hostel_ids(request.user),
                allocation__status="Allocated",
            ).distinct().count()
        elif role == AccountProfile.ROLE_STUDENT:
            student_id = linked_student_id(request.user)
            summary["total_students"] = 1 if student_id else 0
            summary["student_id"] = student_id
            student = Student.objects.filter(student_id=student_id).first()
            allocation = scoped_allocations(request.user).filter(status="Allocated").first()
            summary["student_name"] = student.name if student else None
            summary["student_department"] = student.department if student else None
            summary["student_year"] = student.year_of_study if student else None
            summary["current_allocation"] = (
                {
                    "room_number": allocation.room.room_number,
                    "room_type": allocation.room.room_type,
                    "hostel_name": allocation.room.hostel.hostel_name,
                    "academic_year": allocation.academic_year,
                    "allocation_date": allocation.allocation_date,
                    "status": allocation.status,
                }
                if allocation
                else None
            )
        else:
            summary["total_students"] = 0

        return Response(summary)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            return Response(
                {"error": "Valid credentials are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username.strip(), password=password)
        if user is None or not user.is_active:
            return Response(
                {"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED
            )

        role = get_role(user)
        if role is None:
            return Response(
                {"error": "This account has not been provisioned for DormDesk."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token, _ = Token.objects.get_or_create(user=user)
        profile = get_profile(user)
        return Response(
            {
                "token": token.key,
                "username": user.username,
                "role": role,
                "is_admin": _is_admin(user),
                "student_id": profile.student_id if profile else None,
                "staff_id": profile.staff_id if profile else None,
            }
        )


class AccountProvisionView(APIView):
    permission_classes = [AdminPermission]

    def get(self, request):
        profiles = AccountProfile.objects.select_related("user").order_by(
            "role", "user__username"
        )
        return Response(AccountProfileSerializer(profiles, many=True).data)

    def post(self, request):
        payload = request.data
        username = payload.get("username")
        password = payload.get("password")
        role = payload.get("role")
        student_id = payload.get("student_id")
        staff_id = payload.get("staff_id")

        if not isinstance(username, str) or not username.strip():
            raise ValidationError({"username": "Username is required."})
        if not isinstance(password, str) or len(password) < 8:
            raise ValidationError({"password": "Password must be at least 8 characters."})
        if role not in {choice[0] for choice in AccountProfile.ROLE_CHOICES}:
            raise ValidationError({"role": "Invalid DormDesk role."})
        if student_id is not None and (
            isinstance(student_id, bool)
            or not isinstance(student_id, int)
            or student_id < 1
        ):
            raise ValidationError({"student_id": "Student ID must be a positive integer."})
        if staff_id is not None and (
            isinstance(staff_id, bool)
            or not isinstance(staff_id, int)
            or staff_id < 1
        ):
            raise ValidationError({"staff_id": "Staff ID must be a positive integer."})
        if role == AccountProfile.ROLE_STUDENT and not student_id:
            raise ValidationError({"student_id": "A student account must be linked to a student."})
        if role in {
            AccountProfile.ROLE_WARDEN,
            AccountProfile.ROLE_MAINTENANCE,
        } and not staff_id:
            raise ValidationError({"staff_id": "A staff account must be linked to staff."})
        if role == AccountProfile.ROLE_STUDENT and staff_id:
            raise ValidationError({"staff_id": "A student account cannot link to staff."})
        if role in {
            AccountProfile.ROLE_WARDEN,
            AccountProfile.ROLE_MAINTENANCE,
        } and student_id:
            raise ValidationError({"student_id": "A staff account cannot link to a student."})
        if role == AccountProfile.ROLE_ADMIN and (student_id or staff_id):
            raise ValidationError(
                "An administrator account cannot link to a student or staff record."
            )

        User = get_user_model()
        with transaction.atomic():
            if User.objects.filter(username=username.strip()).exists():
                raise ValidationError({"username": "That username is already in use."})
            if student_id and AccountProfile.objects.filter(student_id=student_id).exists():
                raise ValidationError({"student_id": "That student is already linked."})
            if staff_id and AccountProfile.objects.filter(staff_id=staff_id).exists():
                raise ValidationError({"staff_id": "That staff member is already linked."})
            if student_id and not Student.objects.filter(student_id=student_id).exists():
                raise ValidationError({"student_id": "Student does not exist."})
            if staff_id and not Staff.objects.filter(staff_id=staff_id).exists():
                raise ValidationError({"staff_id": "Staff member does not exist."})
            if staff_id:
                staff = Staff.objects.get(staff_id=staff_id)
                if role != AccountProfile.ROLE_ADMIN and staff.role != role:
                    raise ValidationError(
                        {"staff_id": f"This staff record is not a {role} record."}
                    )

            user = User.objects.create_user(username=username.strip(), password=password)
            profile = AccountProfile.objects.create(
                user=user,
                role=role,
                student_id=student_id if student_id else None,
                staff_id=staff_id if staff_id else None,
            )

        record_audit(
            request,
            action="account.created",
            resource_type="AccountProfile",
            resource_id=profile.id,
            details={"username": user.username, "role": profile.role},
        )

        return Response(
            AccountProfileSerializer(profile).data,
            status=status.HTTP_201_CREATED,
        )


class AccountDetailView(APIView):
    permission_classes = [AdminPermission]

    def patch(self, request, profile_id):
        profile = (
            AccountProfile.objects.select_related("user")
            .filter(id=profile_id)
            .first()
        )
        if profile is None:
            return Response({"detail": "Account not found."}, status=status.HTTP_404_NOT_FOUND)

        if profile.user_id == request.user.id and request.data.get("is_active") is False:
            raise ValidationError("You cannot deactivate your own administrator session.")

        role = request.data.get("role", profile.role)
        student_id = request.data.get("student_id", profile.student_id)
        staff_id = request.data.get("staff_id", profile.staff_id)
        is_active = request.data.get("is_active", profile.user.is_active)
        password = request.data.get("password")

        if role not in {choice[0] for choice in AccountProfile.ROLE_CHOICES}:
            raise ValidationError({"role": "Invalid DormDesk role."})
        if not isinstance(is_active, bool):
            raise ValidationError({"is_active": "Use true or false."})
        if password is not None and (
            not isinstance(password, str) or len(password) < 8
        ):
            raise ValidationError(
                {"password": "Password must be at least 8 characters."}
            )
        if student_id is not None and (
            isinstance(student_id, bool)
            or not isinstance(student_id, int)
            or student_id < 1
        ):
            raise ValidationError({"student_id": "Student ID must be a positive integer."})
        if staff_id is not None and (
            isinstance(staff_id, bool)
            or not isinstance(staff_id, int)
            or staff_id < 1
        ):
            raise ValidationError({"staff_id": "Staff ID must be a positive integer."})

        if role == AccountProfile.ROLE_STUDENT and not student_id:
            raise ValidationError(
                {"student_id": "A student account must be linked to a student."}
            )
        if role in {
            AccountProfile.ROLE_WARDEN,
            AccountProfile.ROLE_MAINTENANCE,
        } and not staff_id:
            raise ValidationError(
                {"staff_id": "A staff account must be linked to staff."}
            )
        if role == AccountProfile.ROLE_ADMIN and (student_id or staff_id):
            raise ValidationError(
                "An administrator account cannot link to a student or staff record."
            )
        if role == AccountProfile.ROLE_STUDENT and staff_id:
            raise ValidationError(
                {"staff_id": "A student account cannot link to staff."}
            )
        if role in {
            AccountProfile.ROLE_WARDEN,
            AccountProfile.ROLE_MAINTENANCE,
        } and student_id:
            raise ValidationError(
                {"student_id": "A staff account cannot link to a student."}
            )
        if student_id and not Student.objects.filter(student_id=student_id).exists():
            raise ValidationError({"student_id": "Student does not exist."})
        if staff_id and not Staff.objects.filter(staff_id=staff_id).exists():
            raise ValidationError({"staff_id": "Staff member does not exist."})
        if staff_id:
            staff = Staff.objects.get(staff_id=staff_id)
            if staff.role != role:
                raise ValidationError(
                    {"staff_id": f"This staff record is not a {role} record."}
                )
        if student_id and AccountProfile.objects.filter(
            student_id=student_id
        ).exclude(id=profile.id).exists():
            raise ValidationError({"student_id": "That student is already linked."})
        if staff_id and AccountProfile.objects.filter(
            staff_id=staff_id
        ).exclude(id=profile.id).exists():
            raise ValidationError({"staff_id": "That staff member is already linked."})

        with transaction.atomic():
            profile.role = role
            profile.student_id = student_id
            profile.staff_id = staff_id
            profile.save(update_fields=["role", "student_id", "staff_id", "updated_at"])
            profile.user.is_active = is_active
            if password:
                profile.user.set_password(password)
            profile.user.save(update_fields=["is_active", "password"] if password else ["is_active"])

        record_audit(
            request,
            action="account.updated",
            resource_type="AccountProfile",
            resource_id=profile.id,
            details={
                "username": profile.user.username,
                "role": profile.role,
                "is_active": profile.user.is_active,
            },
        )

        return Response(AccountProfileSerializer(profile).data)


class AuditLogView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [AdminOrWardenPermission]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor").all()
        if _is_admin(self.request.user):
            return queryset
        return queryset.filter(hostel_id__in=assigned_hostel_ids(self.request.user))


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok", "service": "DormDesk Django API"})
