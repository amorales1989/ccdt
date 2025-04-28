import { supabase } from "@/integrations/supabase/client";
import type { Attendance, Student, Department, DepartmentType, Event } from "@/types/database";

export const getAttendance = async (
  startDate?: string,
  endDate?: string,
  studentId?: string,
  departmentId?: string | null
): Promise<Attendance[]> => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          deleted_at,
          departments:department_id(name)
        )
      `);

    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } else if (startDate) {
      query = query.eq('date', startDate);
    }

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    const { data: attendances, error } = await query;

    if (error) throw error;

    const formattedAttendances = attendances?.map(attendance => {
      const student = attendance.students;
      return {
        ...attendance,
        students: {
          ...student,
          department: student?.departments?.name || '',
          is_deleted: !!student?.deleted_at,
          name: `${student?.first_name} ${student?.last_name}`,
          gender: 'masculino',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        department_name: student?.departments?.name || '',
        department: student?.departments?.name || '',
        event_id: null
      };
    }) || [];

    return formattedAttendances;
  } catch (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }
};

export const getCompany = async (id: number) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching company:', error);
    throw error;
  }
};

export const updateCompany = async (id: number, updates: any) => {
  try {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

export const getStudents = async () => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        departments (name)
      `)
      .order('first_name');

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

export const createStudent = async (student: { first_name: string; gender: string } & Partial<Student>) => {
  try {
    // Remove authorization_id if it exists in the student object
    if (student.authorization_id !== undefined) {
      delete student.authorization_id;
    }
    
    // Map date_of_birth to birthdate for database consistency
    if (student.date_of_birth !== undefined) {
      student.birthdate = student.date_of_birth;
      delete student.date_of_birth;
    }
    
    // Map phone_number to phone for database consistency
    if (student.phone_number !== undefined) {
      student.phone = student.phone_number;
      delete student.phone_number;
    }
    
    const { data, error } = await supabase
      .from('students')
      .insert(student)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
};

export const updateStudent = async (id: string, student: Partial<Student>) => {
  try {
    // Create a clean object with only fields that exist in the students table
    const validFields: Record<string, any> = {
      first_name: student.first_name,
      last_name: student.last_name,
      gender: student.gender,
      address: student.address,
      department_id: student.department_id,
      assigned_class: student.assigned_class,
      document_number: student.document_number,
      deleted_at: student.deleted_at
    };
    
    // Map date_of_birth to birthdate for database consistency
    if (student.date_of_birth !== undefined) {
      validFields.birthdate = student.date_of_birth;
    } else if (student.birthdate !== undefined) {
      validFields.birthdate = student.birthdate;
    }
    
    // Map phone_number to phone for database consistency
    if (student.phone_number !== undefined) {
      validFields.phone = student.phone_number;
    } else if (student.phone !== undefined) {
      validFields.phone = student.phone;
    }

    // Remove undefined values
    const cleanData = Object.fromEntries(
      Object.entries(validFields).filter(([_, value]) => value !== undefined)
    );

    console.log("Updating student with filtered data:", cleanData);
    
    const { data, error } = await supabase
      .from('students')
      .update(cleanData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

export const checkDniExists = async (dni: string) => {
  try {
    const { data, error, count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('document_number', dni);

    if (error) throw error;
    return count && count > 0;
  } catch (error) {
    console.error('Error checking DNI:', error);
    throw error;
  }
};

export const getDepartments = async (): Promise<Department[]> => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching departments:', error);
    throw error;
  }
};

export const updateDepartment = async (id: string, updates: Partial<Department>) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating department:', error);
    throw error;
  }
};

export const createDepartment = async (department: {
  name: DepartmentType;
  description: string;
  classes: string[];
}) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .insert(department)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating department:', error);
    throw error;
  }
};

export const deleteDepartment = async (id: string) => {
  try {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting department:', error);
    throw error;
  }
};

export const getDepartmentByName = async (name: string) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('name', name)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching department by name:', error);
    throw error;
  }
};

export const markAttendance = async (attendanceData: {
  student_id: string;
  date: string;
  status: boolean;
  department_id?: string | null;
  assigned_class?: string;
  event_id?: string;
}) => {
  try {
    console.log("Saving attendance with data:", attendanceData);
    
    const { data: existingAttendance, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('student_id', attendanceData.student_id)
      .eq('date', attendanceData.date)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let result;

    if (existingAttendance) {
      const { data, error } = await supabase
        .from('attendance')
        .update({ 
          status: attendanceData.status,
          assigned_class: attendanceData.assigned_class
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          student_id: attendanceData.student_id,
          status: attendanceData.status,
          date: attendanceData.date,
          department_id: attendanceData.department_id,
          assigned_class: attendanceData.assigned_class,
          event_id: attendanceData.event_id
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log("Attendance saved:", result);
    return result;
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
};

export const getEvents = async () => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

export const createEvent = async (event: { title: string; date: string } & Partial<Event>) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const updateEvent = async (id: string, event: Partial<Event>) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(event)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

export const deleteEvent = async (id: string) => {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

export const importStudentsFromExcel = async (students: { first_name: string; gender: string }[]) => {
  try {
    const validStudents = students.filter(student => 
      student.first_name && student.gender
    );
    
    if (validStudents.length === 0) {
      return { 
        data: [], 
        successful: 0, 
        failed: students.length,
        errors: ['No valid students to import']
      };
    }
    
    const { data, error } = await supabase
      .from('students')
      .insert(validStudents)
      .select();

    if (error) throw error;
    
    return { 
      data,
      successful: data?.length || 0,
      failed: students.length - (data?.length || 0),
      errors: error ? [error.message] : []
    };
  } catch (error) {
    console.error('Error importing students:', error);
    return { 
      data: [],
      successful: 0,
      failed: students.length,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
};
