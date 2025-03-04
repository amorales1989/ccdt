
export interface Student {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gender: string;
  birthdate?: string;
  department?: string;
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
  department?: string;
  assigned_class?: string;
  created_at: string;
  updated_at: string;
  students?: Student;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
}

// Changed from enum to string type
export type DepartmentType = string;

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: string[];
  email?: string;
  assigned_class?: string;
}

export type AppRole = "admin" | "lider" | "director" | "maestro" | "secretaria";
