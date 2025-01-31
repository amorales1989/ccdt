export interface Student {
  id: string;
  name: string;
  age?: number;
  phone?: string;
  address?: string;
  gender: string;
  birthdate?: string;
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
  created_at: string;
}