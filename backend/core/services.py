from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Student, Room, Allocation


@transaction.atomic
def allocate_room(student_id, room_id, academic_year, allocated_by_id=None):

    student = Student.objects.select_for_update().filter(
        student_id=student_id
    ).first()

    if student is None:
        raise ValidationError({
            "student_id": "Student does not exist."
        })

    room = Room.objects.select_related("hostel").select_for_update().filter(
        room_id=room_id
    ).first()

    if room is None:
        raise ValidationError({
            "room_id": "Room does not exist."
        })

    existing_allocation = Allocation.objects.filter(
        student=student,
        status="Allocated"
    ).exists()

    if existing_allocation:
        raise ValidationError({
            "student_id": "Student already has an active room allocation."
        })

    if room.status != "Available":
        raise ValidationError({
            "room_id": "Room is not available for allocation."
        })

    if room.current_occupancy >= room.capacity:
        raise ValidationError({
            "room_id": "Room has reached maximum capacity."
        })

    hostel_gender = room.hostel.gender_type

    if hostel_gender == "Boys" and student.gender != "Male":
        raise ValidationError({
            "room_id": "Student is not eligible for this hostel."
        })

    if hostel_gender == "Girls" and student.gender != "Female":
        raise ValidationError({
            "room_id": "Student is not eligible for this hostel."
        })

    allocation = Allocation.objects.create(
        student=student,
        room=room,
        academic_year=academic_year,
        allocation_date=timezone.localdate(),
        status="Allocated",
        allocated_by_id=allocated_by_id,
    )

    room.current_occupancy += 1

    if room.current_occupancy == room.capacity:
        room.status = "Full"

    room.save(
        update_fields=["current_occupancy", "status"]
    )

    return allocation

def get_active_allocation(student_id):
    allocations = list(
        Allocation.objects.select_for_update()
        .filter(
            student_id=student_id,
            status="Allocated"
        )
        .order_by("allocation_id")[:2]
    )

    if not allocations:
        raise ValidationError({
            "student_id": "Student has no active room allocation."
        })

    if len(allocations) > 1:
        raise ValidationError({
            "student_id": "Multiple active allocations found. "
                          "Contact an administrator."
        })

    return allocations[0]


def check_hostel_eligibility(student, room):
    gender_type = room.hostel.gender_type

    if gender_type == "Boys" and student.gender != "Male":
        raise ValidationError({
            "room_id": "Student is not eligible for this hostel."
        })

    if gender_type == "Girls" and student.gender != "Female":
        raise ValidationError({
            "room_id": "Student is not eligible for this hostel."
        })


def release_room(room):
    if room.current_occupancy <= 0:
        raise ValidationError({
            "room_id": "Room occupancy is already zero."
        })

    room.current_occupancy -= 1

    if room.status == "Full":
        room.status = "Available"

    room.save(
        update_fields=["current_occupancy", "status"]
    )


def occupy_room(room):
    if room.status != "Available":
        raise ValidationError({
            "room_id": "Room is not available."
        })

    if room.current_occupancy >= room.capacity:
        raise ValidationError({
            "room_id": "Room is already full."
        })

    room.current_occupancy += 1

    if room.current_occupancy == room.capacity:
        room.status = "Full"

    room.save(
        update_fields=["current_occupancy", "status"]
    )

@transaction.atomic
def vacate_room(student_id):
    student = (
        Student.objects
        .select_for_update()
        .filter(student_id=student_id)
        .first()
    )

    if student is None:
        raise ValidationError({
            "student_id": "Student does not exist."
        })

    allocation = get_active_allocation(student.student_id)

    room = (
        Room.objects
        .select_for_update()
        .get(room_id=allocation.room_id)
    )

    today = timezone.localdate()

    if allocation.allocation_date > today:
        raise ValidationError({
            "allocation_id": "Allocation date is in the future."
        })

    release_room(room)

    allocation.status = "Vacated"
    allocation.vacate_date = today

    allocation.save(
        update_fields=["status", "vacate_date"]
    )

    return allocation

@transaction.atomic
def reassign_room(student_id, new_room_id, allocated_by_id=None):

    student = (
        Student.objects
        .select_for_update()
        .filter(student_id=student_id)
        .first()
    )

    if student is None:
        raise ValidationError({
            "student_id": "Student does not exist."
        })

    old_allocation = get_active_allocation(student.student_id)
    old_room_id = old_allocation.room_id

    if old_room_id == new_room_id:
        raise ValidationError({
            "room_id": "Student is already allocated to this room."
        })

    room_ids = sorted([old_room_id, new_room_id])

    rooms = list(
        Room.objects
        .select_for_update()
        .filter(room_id__in=room_ids)
        .order_by("room_id")
    )

    room_map = {
        room.room_id: room
        for room in rooms
    }

    if new_room_id not in room_map:
        raise ValidationError({
            "room_id": "New room does not exist."
        })

    old_room = room_map[old_room_id]
    new_room = room_map[new_room_id]

    check_hostel_eligibility(student, new_room)

    if new_room.status != "Available":
        raise ValidationError({
            "room_id": "New room is not available."
        })

    if new_room.current_occupancy >= new_room.capacity:
        raise ValidationError({
            "room_id": "New room is full."
        })

    today = timezone.localdate()

    if old_allocation.allocation_date > today:
        raise ValidationError({
            "allocation_id": "Allocation date is in the future."
        })

    release_room(old_room)

    old_allocation.status = "Vacated"
    old_allocation.vacate_date = today
    old_allocation.save(
        update_fields=["status", "vacate_date"]
    )

    new_allocation = Allocation.objects.create(
        student=student,
        room=new_room,
        academic_year=old_allocation.academic_year,
        allocation_date=today,
        status="Allocated",
        allocated_by_id=(
            allocated_by_id
            if allocated_by_id is not None
            else old_allocation.allocated_by_id
        ),
    )

    occupy_room(new_room)

    return new_allocation
