import { supabase } from "@/integrations/supabase/client";
import { Student, Event, Attendance } from "@/types/database";

// Students API
export const getStudents = async () => {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("name");
  
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
export const getAttendance = async (eventId: string) => {
  const { data, error } = await supabase
    .from("attendance")
    .select(`
      *,
      students (
        id,
        name
      )
    `)
    .eq("event_id", eventId);
  
  if (error) throw error;
  return data;
};

export const markAttendance = async (attendance: Omit<Attendance, "id" | "created_at">) => {
  const { data, error } = await supabase
    .from("attendance")
    .upsert([attendance], {
      onConflict: 'student_id,event_id'
    })
    .select()
    .single();
  
  if (error) throw error;
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