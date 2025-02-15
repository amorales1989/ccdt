
export interface Student {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gender: string;
  birthdate?: string;
  department?: "niños" | "adolescentes" | "jovenes" | "adultos";
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
  department?: "niños" | "adolescentes" | "jovenes" | "adultos";
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: "niños" | "adolescentes" | "jovenes" | "adultos";
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
}

export type DepartmentType = "niños" | "adolescentes" | "jovenes" | "adultos";

