
import { supabase } from "@/integrations/supabase/client";
import { Student, Event, Attendance } from "@/types/database";
import { PostgrestFilterBuilder } from "@supabase/postgrest-js";

// Students API
export const getStudents = async () => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*");
    
    console.log('Fetching students result:', { data, error });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getStudents:', error);
    throw error;
  }
};

export const getStudent = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getStudent:', error);
    throw error;
  }
};

export const createStudent = async (student: Omit<Student, "id" | "created_at" | "updated_at">) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .insert([student])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createStudent:', error);
    throw error;
  }
};

export const updateStudent = async (id: string, student: Partial<Omit<Student, "id" | "created_at" | "updated_at">>) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .update(student)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateStudent:', error);
    throw error;
  }
};

export const deleteStudent = async (id: string) => {
  try {
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteStudent:', error);
    throw error;
  }
};

// Events API
export const getEvents = async () => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date");
    
    console.log('Fetching events result:', { data, error });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getEvents:', error);
    throw error;
  }
};

export const getEvent = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getEvent:', error);
    throw error;
  }
};

export const createEvent = async (event: Omit<Event, "id" | "created_at" | "updated_at">) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .insert([event])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createEvent:', error);
    throw error;
  }
};

export const updateEvent = async (id: string, event: Partial<Omit<Event, "id" | "created_at" | "updated_at">>) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .update(event)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateEvent:', error);
    throw error;
  }
};

export const deleteEvent = async (id: string) => {
  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteEvent:', error);
    throw error;
  }
};

// Attendance API
export const getAttendance = async (startDate?: string, endDate?: string, department?: string) => {
  try {
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
      query = query.eq('students.department', department);
    }

    const { data, error } = await query;
    
    console.log('Attendance query result:', { data, error });
    
    if (error) {
      console.error('Error fetching attendance:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getAttendance:', error);
    throw error;
  }
};

export const markAttendance = async (attendance: Omit<Attendance, "id" | "created_at" | "updated_at">) => {
  try {
    console.log('Marking attendance with data:', attendance);
    
    if (!attendance.student_id || !attendance.date) {
      throw new Error('Missing required fields for attendance');
    }

    // First, get the student's department
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('department')
      .eq('id', attendance.student_id)
      .single();

    if (studentError) {
      console.error('Error fetching student department:', studentError);
      throw studentError;
    }

    const { data, error } = await supabase
      .from("attendance")
      .upsert([
        {
          student_id: attendance.student_id,
          date: attendance.date,
          status: attendance.status,
          department: student.department,
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
  } catch (error) {
    console.error('Error in markAttendance:', error);
    throw error;
  }
};

export const deleteAttendance = async (studentId: string, eventId: string) => {
  try {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("student_id", studentId)
      .eq("event_id", eventId);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteAttendance:', error);
    throw error;
  }
};
