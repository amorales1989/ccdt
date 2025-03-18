import { supabase } from "@/integrations/supabase/client";
import { Student, Event, Attendance, Department, DepartmentType, Company, CompanyConfiguration } from "@/types/database";
import { PostgrestFilterBuilder } from "@supabase/postgrest-js";

// Students API
export const getStudents = async () => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*, departments:department_id(name)");
    
    console.log('Fetching students result:', { data, error });
    if (error) throw error;
    
    // Map department name from the joined department table
    return data.map(student => ({
      ...student,
      department: student.departments?.name
    }));
  } catch (error) {
    console.error('Error in getStudents:', error);
    throw error;
  }
};

export const getStudent = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*, departments:department_id(name)")
      .eq("id", id)
      .single();
    
    if (error) throw error;
    
    // Map department name from the joined department table
    return {
      ...data,
      department: data.departments?.name
    };
  } catch (error) {
    console.error('Error in getStudent:', error);
    throw error;
  }
};

export const checkDniExists = async (dni: string, excludeStudentId?: string) => {
  try {
    let query = supabase
      .from("students")
      .select("id")
      .eq("document_number", dni);
    
    if (excludeStudentId) {
      query = query.neq("id", excludeStudentId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in checkDniExists:', error);
    throw error;
  }
};

export const createStudent = async (student: Omit<Student, "id" | "created_at" | "updated_at">) => {
  try {
    // Check if the DNI already exists
    if (student.document_number) {
      const exists = await checkDniExists(student.document_number);
      if (exists) {
        throw new Error(`El DNI ${student.document_number} ya está registrado en el sistema`);
      }
    }
    
    // If we have a department name, we need to get its ID
    let departmentId = null;
    if (student.department) {
      const { data: deptData } = await supabase
        .from("departments")
        .select("id")
        .eq("name", student.department)
        .single();
      
      if (deptData) {
        departmentId = deptData.id;
      }
    }
    
    // Create student with department_id instead of department
    const studentData = {
      ...student,
      department_id: departmentId
    };
    
    // Remove the department field as we're using department_id
    delete studentData.department;
    
    const { data, error } = await supabase
      .from("students")
      .insert([studentData])
      .select("*, departments:department_id(name)")
      .single();
    
    if (error) throw error;
    
    // Map department name for the returned student
    return {
      ...data,
      department: data.departments?.name
    };
  } catch (error) {
    console.error('Error in createStudent:', error);
    throw error;
  }
};

export const updateStudent = async (id: string, student: Partial<Omit<Student, "id" | "created_at" | "updated_at">>) => {
  try {
    // Check if the DNI already exists (excluding the current student)
    if (student.document_number) {
      const exists = await checkDniExists(student.document_number, id);
      if (exists) {
        throw new Error(`El DNI ${student.document_number} ya está registrado en el sistema`);
      }
    }
    
    // If department is provided, we need to get its ID
    let departmentId = undefined;
    if (student.department) {
      const { data: deptData } = await supabase
        .from("departments")
        .select("id")
        .eq("name", student.department)
        .single();
      
      if (deptData) {
        departmentId = deptData.id;
      }
    }
    
    // Prepare update data with department_id
    const updateData = { ...student };
    
    // Update department_id if we found one
    if (departmentId !== undefined) {
      updateData.department_id = departmentId;
      // Remove department field as we're using department_id
      delete updateData.department;
    }
    
    const { data, error } = await supabase
      .from("students")
      .update(updateData)
      .eq("id", id)
      .select("*, departments:department_id(name)")
      .single();
    
    if (error) throw error;
    
    // Map department name for the returned student
    return {
      ...data,
      department: data.departments?.name
    };
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
export const getAttendance = async (startDate?: string, endDate?: string, department?: string, departmentId?: string | null) => {
  try {
    console.log('Starting attendance fetch with params:', { startDate, endDate, department, departmentId });
    
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
          departments:department_id(name)
        )
      `)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false }) as PostgrestFilterBuilder<any, any, any>;

    // Filter by department ID if provided (higher priority)
    if (departmentId) {
      console.log('Filtering by department ID:', departmentId);
      query = query.eq('department_id', departmentId);
    }
    // Fall back to department name if ID is not provided
    else if (department) {
      console.log('Filtering by department name:', department);
      // Get department id first
      const { data: deptData } = await supabase
        .from("departments")
        .select("id")
        .eq("name", department)
        .single();
      
      if (deptData) {
        query = query.eq('department_id', deptData.id);
      }
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
    
    // Map the department name from the nested departments object
    const mappedData = data.map(record => ({
      ...record,
      students: record.students ? {
        ...record.students,
        department: record.students.departments?.name
      } : null,
      department: record.departments?.name
    }));

    console.log(`Successfully fetched ${mappedData.length} attendance records`);
    return mappedData;
  } catch (error) {
    console.error('Error in getAttendance:', error);
    throw error;
  }
};

// Update markAttendance to use department_id
export const markAttendance = async (attendance: Omit<Attendance, "id" | "created_at" | "updated_at"> & { department_id?: string }) => {
  try {
    console.log('Starting attendance marking with data:', attendance);
    
    if (!attendance.student_id || !attendance.date) {
      const error = new Error('Missing required fields for attendance');
      console.error(error);
      throw error;
    }

    // Get the student's department_id if not provided
    let departmentId = attendance.department_id;
    if (!departmentId) {
      // First, get the student's department_id and class
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('department_id, assigned_class')
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
      
      departmentId = student.department_id;
    }

    // Check if there's an existing attendance record for this student and date
    const { data: existingRecords, error: existingError } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', attendance.student_id)
      .eq('date', attendance.date);

    if (existingError) {
      console.error('Error checking for existing attendance records:', existingError);
      throw existingError;
    }

    // Get the student's class if not already provided
    let assignedClass = attendance.assigned_class;
    if (!assignedClass) {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('assigned_class')
        .eq('id', attendance.student_id)
        .maybeSingle();
      
      if (!studentError && student) {
        assignedClass = student.assigned_class;
      }
    }

    const attendanceData = {
      student_id: attendance.student_id,
      date: attendance.date,
      status: attendance.status,
      department_id: departmentId,
      assigned_class: assignedClass,
      ...(attendance.event_id && { event_id: attendance.event_id })
    };

    let result;
    
    if (existingRecords && existingRecords.length > 0) {
      console.log(`Found ${existingRecords.length} existing attendance record(s), updating:`, existingRecords[0].id);
      // Update the first existing record and delete any others
      
      // First, delete any duplicate records except the first one
      if (existingRecords.length > 1) {
        const recordsToDelete = existingRecords.slice(1).map(r => r.id);
        
        const { error: deleteError } = await supabase
          .from('attendance')
          .delete()
          .in('id', recordsToDelete);
          
        if (deleteError) {
          console.error('Error deleting duplicate attendance records:', deleteError);
          // Continue with the update even if deletion fails
        } else {
          console.log(`Deleted ${recordsToDelete.length} duplicate attendance records`);
        }
      }
      
      // Update the first record
      const { data, error } = await supabase
        .from('attendance')
        .update(attendanceData)
        .eq('id', existingRecords[0].id)
        .select()
        .maybeSingle();
        
      if (error) {
        console.error('Error updating attendance:', error);
        throw error;
      }
      
      result = data;
    } else {
      console.log('No existing record found, creating new attendance record');
      // Create a new record
      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceData])
        .select()
        .maybeSingle();
        
      if (error) {
        console.error('Error inserting attendance:', error);
        throw error;
      }
      
      result = data;
    }
    
    console.log('Successfully marked attendance:', result);
    return result;
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

export const getDepartmentByName = async (name: DepartmentType) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("name", name)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getDepartmentByName:', error);
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

// Company API
export const getCompany = async (id: number = 1) => {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in getCompany:', error);
    throw error;
  }
};

export const updateCompany = async (id: number, updates: Partial<Company>) => {
  try {
    const { data, error } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error in updateCompany:', error);
    throw error;
  }
};

// Note: The company_configurations related functions are no longer needed
// since we moved the configuration directly to the company table
