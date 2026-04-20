import { supabase } from "@/integrations/supabase/client";
import { StudentObservation } from "@/types/database";
import type { Attendance, Student, Department, DepartmentType, Event, Profile } from "@/types/database";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";


// Configuración de la API base
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3001/api';
  }
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://ccdt-back.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();

// Función helper para hacer llamadas a la API
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const companyId = getPersistentCompanyId();

  // Obtener el token de autenticación de Supabase
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Company-Id': companyId.toString(),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
    signal: AbortSignal.timeout(60000), // 60 segundos timeout
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Network error' }));

    // Si el backend reporta tiempo de inactividad, forzar logout
    if (errorData.code === 'INACTIVITY_TIMEOUT') {
      console.warn('Sesión expirada por inactividad. Redirigiendo...');
      await supabase.auth.signOut({ scope: 'global' });
      // Limpiar almacenamiento local
      localStorage.removeItem('selectedDepartment');
      localStorage.removeItem('selectedDepartmentId');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      window.location.href = '/auth'; // Redirigir a login
    }

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
            gender,
            deleted_at,
            departments:department_id(name)
          )
        `)
      .eq('company_id', getPersistentCompanyId());

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
          gender: student?.gender || 'masculino',
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
      .eq('id', getPersistentCompanyId())
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
      .eq('id', getPersistentCompanyId())
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

// ============ FUNCIONES DE MIEMBROS ACTUALIZADAS PARA USAR EL BACKEND ============

export const getStudents = async (params: Record<string, any> = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const endpoint = `/students${query ? `?${query}` : ''}`;
    const response = await apiCall(endpoint);
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

export const uploadStudentPhoto = async (id: string, file: File) => {
  try {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await apiCall(`/students/${id}/photo`, {
      method: 'POST',
      body: formData,
    });
    return response.data || response;
  } catch (error) {
    console.error('Error uploading student photo:', error);
    throw error;
  }
};

export const deleteStudentPhoto = async (id: string) => {
  try {
    const response = await apiCall(`/students/${id}/photo`, {
      method: 'DELETE',
    });
    return response.data || response;
  } catch (error) {
    console.error('Error deleting student photo:', error);
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

export const lookupPersonByDni = async (dni: string) => {
  try {
    const response = await apiCall(`/students/lookup/${encodeURIComponent(dni)}`);
    return response;
  } catch (error) {
    console.error('Error looking up person by DNI:', error);
    return null;
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

export const importUsersFromExcel = async (users: any[]) => {
  try {
    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'bulk-create', userData: { users } }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error importing users:', error);
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
    // Si no, puedes crear múltiples miembros uno por uno
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
      .eq('company_id', getPersistentCompanyId())
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
      .eq('company_id', getPersistentCompanyId())
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
      .insert({ ...department, company_id: getPersistentCompanyId() })
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
      .eq('id', id)
      .eq('company_id', getPersistentCompanyId());

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
      .eq('company_id', getPersistentCompanyId())
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
      .eq('company_id', getPersistentCompanyId())
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
        .eq('company_id', getPersistentCompanyId())
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
          event_id: attendanceData.event_id,
          company_id: getPersistentCompanyId()
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

export const getEvents = async (): Promise<Event[]> => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('company_id', getPersistentCompanyId())
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
      .insert({ ...event, company_id: getPersistentCompanyId() })
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
      .eq('company_id', getPersistentCompanyId())
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
      .eq('id', id)
      .eq('company_id', getPersistentCompanyId());

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

export const getUsers = async (): Promise<Profile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', getPersistentCompanyId());

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const notifyNewRequest = async (requestData: {
  eventTitle: string;
  eventDate: string;
  eventEndDate?: string;
  eventTime?: string;
  eventEndTime?: string;
  department?: string;
  requesterName: string;
  description?: string;
  adminEmails?: string[];
}) => {
  try {
    const response = await apiCall('/events/notify-new-request', {
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
  solicitante_id?: any;
}) => {
  try {
    const response = await apiCall('/events/notify-request-response', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error notifying request response:', error);
    throw error;
  }
};

export const notifyMassiveApprovedEvent = async (requestData: {
  eventTitle: string;
  eventDate: string;
  description?: string;
}) => {
  try {
    const response = await apiCall('/events/notify-massive', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error notifying massive approved event:', error);
    throw error;
  }
};
// ============ FUNCIONES DE FCM (FIREBASE CLOUD MESSAGING) ============

export const registrarTokenFcm = async (tokenData: {
  token: string;
  ua: string;
  plataforma: string;
  idLocal?: string | null;
}) => {
  try {
    const response = await apiCall('/tokens/registrar', {
      method: 'POST',
      body: JSON.stringify(tokenData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error registrando token FCM:', error);
    throw error;
  }
};

export const eliminarTokenFcm = async (token: string) => {
  try {
    const response = await apiCall('/tokens/eliminar', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error eliminando token FCM:', error);
    throw error;
  }
};

export const suscribirATema = async (tokenData: {
  tokens: string[];
  tema: string;
}) => {
  try {
    const response = await apiCall('/fcm/temas/suscribir', {
      method: 'POST',
      body: JSON.stringify(tokenData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error suscribiendo a tema:', error);
    throw error;
  }
};

export const desuscribirDeTema = async (tokenData: {
  tokens: string[];
  tema: string;
}) => {
  try {
    const response = await apiCall('/fcm/temas/desuscribir', {
      method: 'POST',
      body: JSON.stringify(tokenData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error desuscribiendo de tema:', error);
    throw error;
  }
};

// ============ FUNCIONES DE WHATSAPP ============

export const getWhatsappStatus = async (companyId: string | number) => {
  try {
    const response = await apiCall(`/whatsapp/estado?companyId=${companyId}`);
    return response;
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    throw error;
  }
};

export const connectWhatsapp = async (companyId: string | number) => {
  try {
    const response = await apiCall('/whatsapp/conectar', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    return response;
  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    throw error;
  }
};

export const disconnectWhatsapp = async (companyId: string | number) => {
  try {
    const response = await apiCall('/whatsapp/desconectar', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    return response;
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    throw error;
  }
};

export const testWhatsappMessage = async (companyId: string | number, phoneNumber: string, message: string) => {
  try {
    const response = await apiCall('/whatsapp/test', {
      method: 'POST',
      body: JSON.stringify({ companyId, phoneNumber, message }),
    });
    return response;
  } catch (error) {
    console.error('Error sending test WhatsApp message:', error);
    throw error;
  }
};

// ============ FUNCIONES DE OBSERVACIONES DE MIEMBROS ============

export const getObservations = async (studentId: string): Promise<StudentObservation[]> => {
  try {
    const response = await apiCall(`/observations/${studentId}`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching observations:', error);
    throw error;
  }
};

export const addObservation = async (observation: {
  student_id: string;
  observation: string;
  created_by: string;
}) => {
  try {
    const response = await apiCall('/observations', {
      method: 'POST',
      body: JSON.stringify(observation),
    });
    return response.data;
  } catch (error) {
    console.error('Error adding observation:', error);
    throw error;
  }
};

export const updateObservation = async (id: string, text: string) => {
  try {
    const response = await apiCall(`/observations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ observation: text }),
    });
    return response.data;
  } catch (error) {
    console.error('Error updating observation:', error);
    throw error;
  }
};

export const deleteObservation = async (id: string) => {
  try {
    const response = await apiCall(`/observations/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting observation:', error);
    throw error;
  }
};

// ============ FUNCIONES DE MATERIAL DIDÁCTICO ============

export const getMaterials = async (params: { department_id?: string; age_range?: string } = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.department_id) queryParams.append('department_id', params.department_id);
    if (params.age_range) queryParams.append('age_range', params.age_range);

    const endpoint = `/material${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiCall(endpoint);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching materials:', error);
    throw error;
  }
};

export const createMaterial = async (materialData: {
  name: string;
  description?: string;
  file_url: string;
  age_range: string;
  department_id?: string;
  file_size?: number;
}) => {
  try {
    const response = await apiCall('/material', {
      method: 'POST',
      body: JSON.stringify(materialData),
    });
    return response.data;
  } catch (error) {
    console.error('Error creating material:', error);
    throw error;
  }
};

export const deleteMaterial = async (id: string) => {
  try {
    const response = await apiCall(`/material/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting material:', error);
    throw error;
  }
};