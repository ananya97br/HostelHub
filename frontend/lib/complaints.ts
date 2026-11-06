export interface Complaint {
  complaint_id: number;
  student?: number;
  student_name?: string;
  room?: number;
  room_number: string;
  hostel_id?: number;
  hostel_name?: string;
  complaint_type: string;
  description: string;
  priority: string;
  status: string;
  assigned_to?: number | null;
  assigned_staff_name?: string | null;
  resolution_date?: string | null;
  resolution_remarks?: string | null;
  similarity_score?: number;
  date_filed?: string;
  updated_at?: string;
}

export interface Allocation {
  allocation_id: number;
  student: number;
  student_name: string;
  room: number;
  room_number: string;
  status: string;
  academic_year?: string;
  vacate_date?: string | null;
  hostel_id?: number;
  hostel_name?: string;
  allocation_date?: string;
}

export interface SemanticSearchResponse {
  query: string;
  total_results: number;
  results: Complaint[];
}

export const COMPLAINT_TYPES = [
  "Electrical",
  "Plumbing",
  "Furniture",
  "Cleanliness",
  "Roommate Issue",
  "Security",
  "Other",
] as const;

export const COMPLAINT_STATUSES = [
  "Open",
  "In-Progress",
  "Completed",
  "Resolved",
  "Rejected",
] as const;

export const COMPLAINT_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
] as const;
