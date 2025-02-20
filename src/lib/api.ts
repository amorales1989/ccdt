import { supabase } from "@/integrations/supabase/client";
import { Student, Event, Attendance, Department, DepartmentType } from "@/types/database";
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
    console.log('Starting attendance fetch with params:', { startDate, endDate, department });
    
    if (!startDate || !endDate) {
      console.error('Missing required date parameters');
      throw new Error('Start date and end date are required');
    }

    let query = supabase
      .from("attendance")
      .select(`
        *,
        students (
          id,
          name,
          department
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false }) as PostgrestFilterBuilder<any, any, any>;

    if (department) {
      console.log('Filtering by department:', department);
      query = query.eq('students.department', department);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase error fetching attendance:', error);
      throw error;
    }

    if (!data) {
      console.log('No attendance records found for the given criteria');
      return [];
    }

    console.log(`Successfully fetched ${data.length} attendance records`);
    return data;
  } catch (error) {
    console.error('Error in getAttendance:', error);
    throw error;
  }
};

export const markAttendance = async (attendance: Omit<Attendance, "id" | "created_at" | "updated_at">) => {
  try {
    console.log('Starting attendance marking with data:', attendance);
    
    if (!attendance.student_id || !attendance.date) {
      const error = new Error('Missing required fields for attendance');
      console.error(error);
      throw error;
    }

    // First, get the student's department
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('department')
      .eq('id', attendance.student_id)
      .maybeSingle();

    if (studentError) {
      console.error('Error fetching student department:', studentError);
      throw studentError;
    }

    if (!student) {
      const error = new Error(`No student found with ID: ${attendance.student_id}`);
      console.error(error);
      throw error;
    }

    const attendanceData = {
      student_id: attendance.student_id,
      date: attendance.date,
      status: attendance.status,
      department: student.department,
      ...(attendance.event_id && { event_id: attendance.event_id })
    };

    console.log('Upserting attendance record:', attendanceData);

    const { data, error } = await supabase
      .from("attendance")
      .upsert([attendanceData])
      .select()
      .maybeSingle();
    
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
    console.log('Attempting to delete attendance record:', { studentId, eventId });

    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("student_id", studentId)
      .eq("event_id", eventId);
    
    if (error) {
      console.error('Error deleting attendance:', error);
      throw error;
    }

    console.log('Successfully deleted attendance record');
  } catch (error) {
    console.error('Error in deleteAttendance:', error);
    throw error;
  }
};

// Departments API
export const getDepartments = async () => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order('name');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
};

export const getDepartment = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getDepartment:', error);
    throw error;
  }
};

export const updateDepartment = async (id: string, updates: { description?: string; classes?: string[] }) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateDepartment:', error);
    throw error;
  }
};

export const createDepartment = async (department: { name: DepartmentType; description?: string; classes: string[] }) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .insert([department])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in createDepartment:', error);
    throw error;
  }
};

export const deleteDepartment = async (id: string) => {
  try {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error in deleteDepartment:', error);
    throw error;
  }
};
