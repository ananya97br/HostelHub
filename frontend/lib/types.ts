export interface Room {
  room_id: number;
  hostel?: number;
  hostel_id: number;
  hostel_name?: string;
  room_number: string;
  floor_number: number;
  room_type: string;
  capacity: number;
  current_occupancy: number;
  vacant_seats: number;
  status: string;
  is_available: boolean;
  rent_per_semester: string;
}

export interface Hostel {
  hostel_id: number;
  hostel_name: string;
  gender_type: string;
  total_rooms: number;
  warden_id: number | null;
  warden_name?: string | null;
  hostel_address: string | null;
}

export interface Staff {
  staff_id: number;
  name: string;
  role: string;
  email?: string | null;
  hostel?: number | null;
  hostel_name?: string | null;
}

export type DormRole = "Admin" | "Warden" | "Maintenance" | "Student";

export interface DormAccount {
  id: number;
  username: string;
  role: DormRole;
  student_id: number | null;
  student_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  event_id: number;
  actor_username: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  hostel_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuthUser {
  username: string;
  role: DormRole | null;
  is_admin: boolean;
  student_id: number | null;
  staff_id: number | null;
}

export interface DashboardSummary {
  role: DormRole | null;
  total_students: number;
  total_complaints: number;
  completed_complaints: number;
  in_progress_complaints: number;
  resolved_complaints: number;
  urgent_complaints: number;
  total_rooms: number;
  total_capacity: number;
  occupied_beds: number;
  available_beds: number;
  available_rooms: number;
  full_rooms: number;
  open_complaints: number;
  hostels: number;
  student_id?: number | null;
  student_name?: string | null;
  student_department?: string | null;
  student_year?: number | null;
  current_allocation?: {
    room_number: string;
    room_type: string;
    hostel_name: string;
    academic_year: string;
    allocation_date: string;
    status: string;
  } | null;
}

export interface Student {
  student_id: number;
  name: string;
  gender: string;
  date_of_birth?: string;
  department: string;
  year_of_study: number;
  contact_number?: string;
  email: string;
  guardian_name?: string | null;
  guardian_contact?: string | null;
  special_requirements?: string | null;
  admission_date?: string;
}
