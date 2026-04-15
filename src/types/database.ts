export interface StudentObservation {
  id: string;
  student_id: string;
  observation: string;
  created_at: string;
  created_by?: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export interface Student {
  // Campos básicos que existen en la tabla
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
  nuevo?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  // Relaciones
  departments?: {
    name?: DepartmentType;
    id?: string;
  };
  student_authorizations?: {
    name?: string;
    id?: string;
  };
  observations?: StudentObservation[];

  // Campos computados (solo para el frontend)
  is_authorized?: boolean;
  isAuthorized?: boolean;
  is_deleted?: boolean;
  name?: string;
  authorization_id?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  end_date?: string;
  end_time?: string;
  description?: string;
  departamento?: string;
  solicitud?: boolean;
  estado?: 'pendiente' | 'aprobada' | 'rechazada' | string;
  solicitante?: string;
  motivoRechazo?: string;
  created_at: string;
  updated_at: string;
  isBirthday?: boolean;
}

export interface EventWithBirthday extends Event {
  isBirthday?: boolean;
  daysUntilBirthday?: number;
  assigned_class?: string;
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
  students?: Student | any;
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
  auth_pdf_header?: { text: string; enabled: boolean }[];
}

export type DepartmentType =
  | "escuelita"
  | "adolescentes"
  | "jovenes"
  | "adultos"
  | string;

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: DepartmentType[];
  department_id?: string;
  email?: string;
  phone?: string;
  assigned_class?: string;
  birthdate?: string;
  gender?: string;
  document_number?: string;
}

export type AppRole = "admin" | "lider" | "director" | "director_general" | "maestro" | "secretaria" | "secr.-calendario" | "colaborador" | "vicedirector";

export interface StudentAuthorization {
  id: string;
  student_id: string;
  department_id: string;
  class?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
  department?: Department;
  name?: string;
}