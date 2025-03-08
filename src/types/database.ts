export interface Student {
  id: string;
  name: string;
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
  departments?: { 
    name?: DepartmentType;
    id?: string;
  };
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
  department_id?: string;
  assigned_class?: string;
  created_at: string;
  updated_at: string;
  students?: Student;
  departments?: {
    name?: DepartmentType;
    id?: string;
  };
}

export interface Department {
  id: string;
  name: DepartmentType;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
}

export type DepartmentType = 
  | "escuelita_central" 
  | "pre_adolescentes" 
  | "adolescentes" 
  | "jovenes" 
  | "jovenes_adultos" 
  | "adultos"
  | "Examen Físico_Rev1" 
  | string; // Added string to allow for any department name from database

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
