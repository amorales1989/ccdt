
export interface Student {
  id: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  address?: string;
  gender: string;
  birthdate?: string;
  department?: DepartmentType;
  department_id?: string;
  assigned_class?: string;
  document_number?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  departments?: { 
    name?: DepartmentType;
    id?: string;
  };
  is_authorized?: boolean;
  is_deleted?: boolean;
  name?: string; // Add this for convenience
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  event_id?: string;
  date: string;
  status: boolean;
  department?: DepartmentType;
  department_id?: string;
  assigned_class?: string;
  created_at: string;
  updated_at: string;
  students?: Student | any; // Making this more flexible
  department_name?: string;
}

export interface Department {
  id: string;
  name: DepartmentType;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: number;
  name: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  dark_mode?: boolean;
  auto_save?: boolean;
  notifications?: boolean;
  show_attendance_history?: boolean;
  compact_view?: boolean;
  show_profile_images?: boolean;
  congregation_name?: string;
  show_name?: boolean;
}

export type DepartmentType = 
  | "escuelita_central" 
  | "pre_adolescentes" 
  | "adolescentes" 
  | "jovenes" 
  | "jovenes_adultos" 
  | "adultos"
  | "Examen Físico_Rev1" 
  | string;

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: DepartmentType[];
  department_id?: string;
  email?: string;
  assigned_class?: string;
}

export type AppRole = "admin" | "lider" | "director" | "maestro" | "secretaria";

export interface StudentAuthorization {
  id: string;
  student_id: string;
  department_id: string;
  class?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  department?: Department;
}
