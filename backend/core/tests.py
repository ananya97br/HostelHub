from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase
from rest_framework import serializers

from .models import AccountProfile
from .permissions import AdminPermission, get_role
from .serializers import (
    AccountProfileSerializer,
    AllocationCreateSerializer,
    ComplaintSerializer,
    StudentSerializer,
)


class PermissionContractTests(SimpleTestCase):
    def test_superuser_is_the_only_implicit_admin(self):
        superuser = SimpleNamespace(
            is_authenticated=True,
            is_superuser=True,
            dorm_profile=None,
        )
        ordinary_staff_flag = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            is_staff=True,
            dorm_profile=None,
        )

        self.assertEqual(get_role(superuser), AccountProfile.ROLE_ADMIN)
        self.assertIsNone(get_role(ordinary_staff_flag))

    def test_explicit_profile_controls_role(self):
        user = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            dorm_profile=SimpleNamespace(
                role=AccountProfile.ROLE_WARDEN,
                staff_id=1,
                student_id=None,
            ),
        )
        request = SimpleNamespace(user=user)

        self.assertEqual(get_role(user), AccountProfile.ROLE_WARDEN)
        self.assertFalse(AdminPermission().has_permission(request, None))


class ValidationContractTests(SimpleTestCase):
    def test_account_profile_serializer_exposes_safe_identity_fields(self):
        profile = SimpleNamespace(
            id=4,
            role=AccountProfile.ROLE_STUDENT,
            student_id=None,
            staff_id=None,
            user=SimpleNamespace(username="student.one", is_active=True),
            created_at=None,
        )
        data = AccountProfileSerializer(profile).data
        self.assertEqual(data["username"], "student.one")
        self.assertNotIn("password", data)

    def test_allocation_academic_year_must_be_consecutive(self):
        serializer = AllocationCreateSerializer(data={
            "student_id": 1,
            "room_id": 1,
            "academic_year": "2025-2027",
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("academic_year", serializer.errors)

    def test_student_fields_reject_future_birth_date(self):
        serializer = StudentSerializer()
        self.assertEqual(serializer.validate_date_of_birth(date.today()), date.today())
        with self.assertRaises(serializers.ValidationError):
            serializer.validate_date_of_birth(date.today().replace(year=date.today().year + 1))

    def test_student_profile_validation_rejects_identity_changes(self):
        student = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            dorm_profile=SimpleNamespace(
                role=AccountProfile.ROLE_STUDENT,
                student_id=1,
                staff_id=None,
            ),
        )
        serializer = StudentSerializer(
            instance=SimpleNamespace(),
            context={"request": SimpleNamespace(user=student)},
        )
        with self.assertRaises(serializers.ValidationError):
            serializer.validate({"name": "Changed Name"})

    def test_maintenance_cannot_finalize_a_complaint(self):
        maintenance = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            dorm_profile=SimpleNamespace(
                role=AccountProfile.ROLE_MAINTENANCE,
                student_id=None,
                staff_id=3,
            ),
        )
        serializer = ComplaintSerializer(
            instance=SimpleNamespace(
                status="In-Progress",
                student=SimpleNamespace(student_id=1),
                student_id=1,
                room=SimpleNamespace(room_id=1),
                room_id=1,
                assigned_to=SimpleNamespace(role="Maintenance"),
                resolution_remarks=None,
            ),
            data={"status": "Resolved", "resolution_remarks": "Completed"},
            partial=True,
            context={"request": SimpleNamespace(user=maintenance)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("status", serializer.errors)

    def test_maintenance_can_mark_work_completed_with_remarks(self):
        maintenance = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            dorm_profile=SimpleNamespace(
                role=AccountProfile.ROLE_MAINTENANCE,
                student_id=None,
                staff_id=3,
            ),
        )
        serializer = ComplaintSerializer(
            instance=SimpleNamespace(
                status="In-Progress",
                student=SimpleNamespace(student_id=1),
                student_id=1,
                room=SimpleNamespace(room_id=1),
                room_id=1,
                assigned_to=SimpleNamespace(role="Maintenance"),
                resolution_remarks=None,
            ),
            data={"status": "Completed", "resolution_remarks": "Repair finished."},
            partial=True,
            context={"request": SimpleNamespace(user=maintenance)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["resolution_remarks"], "Repair finished.")

    def test_complaint_category_and_description_are_validated(self):
        serializer = ComplaintSerializer()
        self.assertEqual(serializer.validate_complaint_type("Electrical"), "Electrical")
        with self.assertRaises(serializers.ValidationError):
            serializer.validate_complaint_type("Not a category")
        with self.assertRaises(serializers.ValidationError):
            serializer.validate_description("   ")

    def test_resolved_complaints_cannot_be_rejected_directly(self):
        admin = SimpleNamespace(
            is_authenticated=True,
            is_superuser=True,
            dorm_profile=None,
        )
        instance = SimpleNamespace(
            status="Resolved",
            student=SimpleNamespace(student_id=1),
            student_id=1,
            room=SimpleNamespace(room_id=1),
            room_id=1,
            assigned_to=None,
            resolution_remarks="Fixed",
        )
        serializer = ComplaintSerializer(
            instance=instance,
            data={"status": "Rejected"},
            partial=True,
            context={"request": SimpleNamespace(user=admin)},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("status", serializer.errors)
