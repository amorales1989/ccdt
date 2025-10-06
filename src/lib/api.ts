  import { supabase } from "@/integrations/supabase/client";
  import type { Attendance, Student, Department, DepartmentType, Event } from "@/types/database";


  // Configuración de la API base
  const API_BASE_URL = 'https://ccdt-back.onrender.com';
 // const API_BASE_URL = 'http://localhost:3001';

  // Función helper para hacer llamadas a la API
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
    signal: AbortSignal.timeout(60000), // 60 segundos timeout
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

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

  // ============ FUNCIONES DE ESTUDIANTES ACTUALIZADAS PARA USAR EL BACKEND ============

  export const getStudents = async () => {
    console.log('Entro')
    try {
      const response = await apiCall('/students');
      return response.data || response;
    } catch (error) {
      console.error('Error fetching students:', error);
      throw error;
    }
  };

  export const getStudentById = async (id: string) => {
    try {
      const response = await apiCall(`/students/${id}`);
      return response.data || response;
    } catch (error) {
      console.error('Error fetching student by ID:', error);
      throw error;
    }
  };

  export const createStudent = async (student: { first_name: string; gender: string } & Partial<Student>) => {
    try {
      const response = await apiCall('/students', {
        method: 'POST',
        body: JSON.stringify(student),
      });
      return response.data || response;
    } catch (error) {
      console.error('Error creating student:', error);
      throw error;
    }
  };

  export const updateStudent = async (id: string, student: Partial<Student>) => {
    try {
      const response = await apiCall(`/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(student),
      });
      return response.data || response;
    } catch (error) {
      console.error('Error updating student:', error);
      throw error;
    }
  };

  export const deleteStudent = async (id: string) => {
    try {
      const response = await apiCall(`/students/${id}`, {
        method: 'DELETE',
      });
      return response.data || response;
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  };

  export const checkDniExists = async (dni: string) => {
    try {
      const response = await apiCall(`/students/search?document_number=${encodeURIComponent(dni)}`);
      const students = response.data || response;
      return students && students.length > 0;
    } catch (error) {
      console.error('Error checking DNI:', error);
      // Si hay error en la búsqueda, asumimos que no existe
      return false;
    }
  };

  export const searchStudents = async (searchTerm: string) => {
    try {
      const response = await apiCall(`/students/search?q=${encodeURIComponent(searchTerm)}`);
      return response.data || response;
    } catch (error) {
      console.error('Error searching students:', error);
      throw error;
    }
  };

  export const getStudentStats = async () => {
    try {
      const response = await apiCall('/students/stats');
      return response.data || response;
    } catch (error) {
      console.error('Error fetching student stats:', error);
      throw error;
    }
  };

  export const getUpcomingBirthdays = async () => {
    try {
      const response = await apiCall('/students/birthdays/upcoming');
      return response.data || response;
    } catch (error) {
      console.error('Error fetching upcoming birthdays:', error);
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
      
      // Si tu backend tiene un endpoint específico para importación masiva, úsalo
      // Si no, puedes crear múltiples estudiantes uno por uno
      const results = {
        data: [] as any[],
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const student of validStudents) {
        try {
          const response = await apiCall('/students', {
            method: 'POST',
            body: JSON.stringify(student),
          });
          results.data.push(response.data || response);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      return results;
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

  // ============ FUNCIONES QUE SIGUEN USANDO SUPABASE (NO RELACIONADAS CON STUDENTS) ============

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

  export async function getUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
    
    return data;
  }

export const notifyNewRequest = async (requestData: {
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  department?: string;
  requesterName: string;
  description?: string;
  adminEmails?: string[];
}) => {
  try {
    const response = await apiCall('/api/events/notify-new-request', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error notifying new request:', error);
    throw error;
  }
};

export const notifyRequestResponse = async (requestData: {
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
  department?: string;
  requesterName: string;
  requesterEmail: string;
  estado: 'aprobado' | 'rechazado';
  adminMessage?: string;
  description?: string;
}) => {
  try {
    const response = await apiCall('/api/events/notify-request-response', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error notifying request response:', error);
    throw error;
  }
};