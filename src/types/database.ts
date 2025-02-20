
export interface Student {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gender: string;
  birthdate?: string;
  department?: DepartmentType;
  assigned_class?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
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
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: DepartmentType;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
}

export type DepartmentType = "escuelita_central" | "pre_adolescentes" | "adolescentes" | "jovenes" | "jovenes_adultos" | "adultos";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: DepartmentType[];
  email?: string;
  assigned_class: string | null;
}

export type AppRole = "admin" | "lider" | "director" | "maestro" | "secretaria";
