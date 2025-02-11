import { supabase } from "@/integrations/supabase/client";
import { Student, Event, Attendance } from "@/types/database";
import { PostgrestFilterBuilder } from "@supabase/postgrest-js";

// Students API
export const getStudents = async () => {
  const { data, error } = await supabase
    .from("students")
    .select("*") 
    console.log('Fetching students:', data);
  if (error) throw error;
  return data;
};

export const getStudent = async (id: string) => {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) throw error;
  return data;
};

export const createStudent = async (student: Omit<Student, "id" | "created_at" | "updated_at">) => {
  const { data, error } = await supabase
    .from("students")
    .insert([student])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateStudent = async (id: string, student: Partial<Omit<Student, "id" | "created_at" | "updated_at">>) => {
  const { data, error } = await supabase
    .from("students")
    .update(student)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteStudent = async (id: string) => {
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
};

// Events API
export const getEvents = async () => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("date");
  
  if (error) throw error;
  return data;
};

export const getEvent = async (id: string) => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) throw error;
  return data;
};

export const createEvent = async (event: Omit<Event, "id" | "created_at" | "updated_at">) => {
  const { data, error } = await supabase
    .from("events")
    .insert([event])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateEvent = async (id: string, event: Partial<Omit<Event, "id" | "created_at" | "updated_at">>) => {
  const { data, error } = await supabase
    .from("events")
    .update(event)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteEvent = async (id: string) => {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
};

// Attendance API
export const getAttendance = async (startDate?: string, endDate?: string, department?: string) => {
  console.log('Fetching attendance with params:', { startDate, endDate, department });
  
  let query = supabase
    .from("attendance")
    .select(`
      *,
      students (
        id,
        name,
        department
      )
    `) as PostgrestFilterBuilder<any, any, any>;

  if (startDate && endDate) {
    query = query.gte('date', startDate).lte('date', endDate);
  }

  if (department) {
    query = query.eq('department', department);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }

  return data;
};

export const markAttendance = async (attendance: Omit<Attendance, "id" | "created_at" | "updated_at">) => {
  console.log('Marking attendance with data:', attendance);
  
  // Ensure all required fields are present
  if (!attendance.student_id || !attendance.date) {
    throw new Error('Missing required fields for attendance');
  }

  const { data, error } = await supabase
    .from("attendance")
    .upsert([
      {
        student_id: attendance.student_id,
        date: attendance.date,
        status: attendance.status,
        department: attendance.department,
        // event_id is optional in the schema
        ...(attendance.event_id && { event_id: attendance.event_id })
      }
    ])
    .select()
    .single();
  
  if (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
  
  console.log('Successfully marked attendance:', data);
  return data;
};

export const deleteAttendance = async (studentId: string, eventId: string) => {
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("student_id", studentId)
    .eq("event_id", eventId);
  
  if (error) throw error;
};
