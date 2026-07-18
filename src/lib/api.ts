import { supabase } from "@/integrations/supabase/client";
import { StudentObservation } from "@/types/database";
import type { Attendance, Student, Department, DepartmentType, Event, Profile } from "@/types/database";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { normalizeName } from "@/lib/utils";
import { isDemoMode, resolveDemoApiCall } from "@/lib/demo";

const normalizeStudentNames = <T extends Partial<Student>>(s: T): T => ({
  ...s,
  ...(s.first_name !== undefined ? { first_name: normalizeName(s.first_name) } : {}),
  ...(s.last_name !== undefined ? { last_name: normalizeName(s.last_name) } : {}),
});


// Configuración de la API base
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:3001/api';
  }
  return import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.n-xus.com/api';
};

const resolveLocalPort = async (): Promise<string> => {
  try {
    const res = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(1000) });
    if (res.ok) return 'http://localhost:3001/api';
  } catch {}
  return 'http://localhost:3002/api';
};

let _resolvedLocalUrl: string | null = null;
const getResolvedBaseUrl = async (): Promise<string> => {
  const base = getApiBaseUrl();
  if (!base.includes('localhost')) return base;
  if (!_resolvedLocalUrl) _resolvedLocalUrl = await resolveLocalPort();
  return _resolvedLocalUrl;
};

const API_BASE_URL = getApiBaseUrl();

// Función helper para hacer llamadas a la API
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  if (isDemoMode()) return resolveDemoApiCall(endpoint, options);
  const baseUrl = await getResolvedBaseUrl();
  const url = `${baseUrl}${endpoint}`;
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

    // Empresa suspendida (ej. falta de pago): cerrar sesión y mostrar modal en el login.
    if (errorData.code === 'COMPANY_INACTIVE') {
      sessionStorage.setItem('company_suspended', '1');
      if (errorData.role) sessionStorage.setItem('company_suspended_role', errorData.role);
      await supabase.auth.signOut({ scope: 'global' });
      localStorage.removeItem('selectedDepartment');
      localStorage.removeItem('selectedDepartmentId');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      window.location.href = '/';
    }

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
  departmentId?: string | null,
  assignedClass?: string
): Promise<Attendance[]> => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
          *,
          attendance_department:department_id(name),
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

    if (departmentId !== undefined && departmentId !== null) {
      query = query.eq('department_id', departmentId);
    }

    if (assignedClass && assignedClass !== 'all') {
      // Use ilike for case-insensitive matching
      query = query.ilike('assigned_class', assignedClass);
    }

    const { data: attendances, error } = await query;

    if (error) throw error;

    const formattedAttendances = attendances?.map((attendance: any) => {
      const student = attendance.students;
      const attendanceDeptName = attendance.attendance_department?.name || student?.departments?.name || '';
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
        department_name: attendanceDeptName,
        department: attendanceDeptName,
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

// ============ SYSTEM ADMIN (super admin / panel de empresas) ============

export type AdminCompany = {
  id: number;
  name: string;
  congregation_name: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
  member_count: number;
  plan?: string | null;
  billing_cycle?: string;
  last_payment_date?: string | null;
  due_date?: string | null;
  extra_member_packs: number;
};

export type Payment = {
  id: number;
  company_id: number;
  amount: number;
  currency: string;
  billing_cycle: string | null;
  period_start: string | null;
  period_end: string | null;
  source: string;
  notes: string | null;
  created_at: string;
};

export type PlanRow = {
  value: string;
  label: string;
  member_limit: number | null;
  price_monthly: number;
  pack_price_monthly: number;
  sort: number;
};

export type CompanyAdmin = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

export const getAllCompanies = async (): Promise<AdminCompany[]> => {
  const res = await apiCall('/system/companies');
  return res.data;
};

export const createCompany = async (data: { name: string; congregation_name?: string }): Promise<AdminCompany> => {
  const res = await apiCall('/system/companies', { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const setCompanyStatus = async (id: number, is_active: boolean): Promise<AdminCompany> => {
  const res = await apiCall(`/system/companies/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
  return res.data;
};

export const setCompanyPlan = async (id: number, plan: string | null): Promise<AdminCompany> => {
  const res = await apiCall(`/system/companies/${id}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) });
  return res.data;
};

export const setCompanyPacks = async (id: number, extra_member_packs: number): Promise<AdminCompany> => {
  const res = await apiCall(`/system/companies/${id}/packs`, { method: 'PATCH', body: JSON.stringify({ extra_member_packs }) });
  return res.data;
};

export const recordPayment = async (id: number, data: { amount: number; billing_cycle: string; source?: string; notes?: string }): Promise<AdminCompany> => {
  const res = await apiCall(`/system/companies/${id}/payments`, { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const getCompanyPayments = async (id: number): Promise<Payment[]> => {
  const res = await apiCall(`/system/companies/${id}/payments`);
  return res.data;
};

export const updateCompanyInfo = async (id: number, data: { name: string; congregation_name?: string }): Promise<AdminCompany> => {
  const res = await apiCall(`/system/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.data;
};

export const deleteCompany = async (id: number) => {
  return apiCall(`/system/companies/${id}`, { method: 'DELETE' });
};

export const getCompanyAdmins = async (id: number): Promise<CompanyAdmin[]> => {
  const res = await apiCall(`/system/companies/${id}/admins`);
  return res.data;
};

export const createCompanyAdmin = async (
  id: number,
  data: { email: string; password: string; first_name?: string; last_name?: string }
) => {
  const res = await apiCall(`/system/companies/${id}/admin`, { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const updateAdminPassword = async (userId: string, password: string) => {
  return apiCall(`/system/admins/${userId}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
};

export const getPlans = async (): Promise<PlanRow[]> => {
  const res = await apiCall('/system/plans');
  return res.data;
};

export const updatePlanPricing = async (
  value: string,
  data: { price_monthly: number; pack_price_monthly: number }
): Promise<PlanRow> => {
  const res = await apiCall(`/system/plans/${value}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.data;
};

// ============ SUSCRIPCIÓN (empresa) ============

export type SubscriptionInfo = {
  plan: string | null;
  extra_member_packs: number;
  billing_cycle: string;
  due_date: string | null;
  last_payment_date: string | null;
  pending_plan: string | null;
  pending_extra_member_packs: number | null;
  member_count: number;
  plans: PlanRow[];
  mp_preapproval_id?: string | null;
  subscription_status?: string | null;
};

export const getSubscription = async (): Promise<SubscriptionInfo> => {
  return apiCall('/subscription');
};

export const getMyPayments = async (): Promise<Payment[]> => {
  const res = await apiCall('/subscription/payments');
  return res.data;
};

export const renewSubscription = async (billing_cycle: 'mensual' | 'anual'): Promise<{ init_point: string; amount: number }> => {
  return apiCall('/subscription/renew', { method: 'POST', body: JSON.stringify({ billing_cycle }) });
};

export const subscribe = async (billing_cycle: 'mensual' | 'anual'): Promise<{ init_point: string }> => {
  return apiCall('/subscription/subscribe', { method: 'POST', body: JSON.stringify({ billing_cycle }) });
};

export type SubscriptionQuote = { mode: 'charge' | 'schedule'; amount: number; effect?: string };

export const getQuote = async (
  params: { type: 'plan'; plan: string } | { type: 'packs'; delta: number }
): Promise<SubscriptionQuote> => {
  const qs = params.type === 'plan'
    ? `type=plan&plan=${encodeURIComponent(params.plan)}`
    : `type=packs&delta=${params.delta}`;
  return apiCall(`/subscription/quote?${qs}`);
};

export const changePlan = async (plan: string): Promise<{ mode: 'charge' | 'schedule'; init_point?: string; amount?: number }> => {
  return apiCall('/subscription/change-plan', { method: 'POST', body: JSON.stringify({ plan }) });
};

export const changePacks = async (
  delta: number
): Promise<{ mode: 'charge' | 'schedule'; init_point?: string; amount?: number; pending_extra_member_packs?: number }> => {
  return apiCall('/subscription/packs', { method: 'POST', body: JSON.stringify({ delta }) });
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
      body: JSON.stringify(normalizeStudentNames(student)),
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
      body: JSON.stringify(normalizeStudentNames(student)),
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

export const deleteStudent = async (id: string, departmentId?: string | null) => {
  try {
    const qs = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    const response = await apiCall(`/students/${id}${qs}`, {
      method: 'DELETE',
    });
    return response.data || response;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

export const addStudentDepartment = async (studentId: string, assignment: { department_id: string; assigned_class?: string | null; role_in_dept?: string }) => {
  const response = await apiCall(`/students/${studentId}/departments`, {
    method: 'POST',
    body: JSON.stringify(assignment),
  });
  return response.data || response;
};

export const removeStudentDepartment = async (studentId: string, departmentId: string) => {
  await apiCall(`/students/${studentId}/departments/${departmentId}`, { method: 'DELETE' });
};

// Borra la cuenta de usuario pero conserva a la persona como miembro de la congregación.
export const convertUserToMember = async (userId: string) => {
  return apiCall(`/profiles/${userId}/convert-to-member`, { method: 'POST' });
};

// Saca la ficha de miembro del usuario de todos sus departamentos (rol "miembro").
export const clearMemberDepartments = async (userId: string) => {
  return apiCall(`/profiles/${userId}/clear-member-departments`, { method: 'POST' });
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

export const getMemberCount = async (): Promise<number> => {
  const res = await apiCall('/students/stats?group_by=general');
  return res?.data?.total ?? 0;
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
  activity_days?: number[];
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

    let lookupQuery = supabase
      .from('attendance')
      .select('*')
      .eq('student_id', attendanceData.student_id)
      .eq('date', attendanceData.date)
      .eq('company_id', getPersistentCompanyId());

    if (attendanceData.department_id) {
      lookupQuery = lookupQuery.eq('department_id', attendanceData.department_id);
    } else {
      lookupQuery = lookupQuery.is('department_id', null);
    }

    const { data: existingAttendance, error: fetchError } = await lookupQuery.maybeSingle();

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

export const deleteAttendanceByDate = async (params: {
  date: string;
  department_id?: string | null;
  assigned_class?: string;
}): Promise<number> => {
  try {
    const response = await apiCall('/attendance/by-date', {
      method: 'DELETE',
      body: JSON.stringify(params),
    });
    return response.deleted || 0;
  } catch (error) {
    console.error('Error deleting attendance by date:', error);
    throw error;
  }
};

export type CoverageClass = { clase: string; tomada: boolean; presentes: number; total: number };
export type CoverageDept = { department_id: string; name: string; total_clases: number; tomadas: number; classes: CoverageClass[] };

// Cobertura de asistencia: qué clases tomaron asistencia un día y cuáles no (directores/vicedir.)
// Si no se pasa `date`, el back resuelve la última fecha con actividad segun los días del depto.
export const getAttendanceCoverage = async (
  date?: string,
  departmentId?: string
): Promise<{ date: string; departments: CoverageDept[] }> => {
  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  if (departmentId) qs.set('department_id', departmentId);
  const q = qs.toString();
  const response = await apiCall(`/attendance/coverage${q ? `?${q}` : ''}`);
  return { date: response?.date || date || '', departments: response?.departments || [] };
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

export const notifyMaintenanceRequest = async (requestData: {
  title: string;
  location?: string;
  requesterName: string;
  description?: string;
  priority: string;
}) => {
  try {
    const response = await apiCall('/maintenance/notify', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error notifying maintenance request:', error);
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

export const runBirthdayCron = async (companyId: string | number) => {
  try {
    const response = await apiCall('/whatsapp/run-birthday-cron', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    return response;
  } catch (error) {
    console.error('Error running birthday cron:', error);
    throw error;
  }
};

// ============ FUNCIONES DE OBSERVACIONES DE MIEMBROS ============

// ============ FUNCIONES DE INFORMES DE PERSONAL ============

export const getEligibleStaff = async (department: string, assignedClass: string) => {
  try {
    const response = await apiCall(`/staff-reports/eligible?department=${encodeURIComponent(department)}&assigned_class=${encodeURIComponent(assignedClass)}`);
    return response.data || response;
  } catch (error) {
    console.error('Error fetching eligible staff:', error);
    throw error;
  }
};

export const getStaffReports = async (userRole: string, userId: string, department?: string) => {
  try {
    let url = `/staff-reports?user_role=${encodeURIComponent(userRole)}&user_id=${encodeURIComponent(userId)}`;
    if (department) {
      url += `&user_department=${encodeURIComponent(department)}`;
    }
    const response = await apiCall(url);
    return response.data || response;
  } catch (error) {
    console.error('Error fetching staff reports:', error);
    throw error;
  }
};

export const createStaffReport = async (reportData: {
  target_user_id: string;
  report: string;
  department: string;
  assigned_class: string;
  created_by: string;
}) => {
  try {
    const response = await apiCall('/staff-reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error creating staff report:', error);
    throw error;
  }
};

export const getUnreadStaffReportsCount = async (userRole: string, department?: string) => {
  try {
    if (!department) return 0;
    const response = await apiCall(`/staff-reports/unread-count?user_role=${encodeURIComponent(userRole)}&user_department=${encodeURIComponent(department)}`);
    return response.count || 0;
  } catch (error) {
    console.error('Error fetching unread staff reports count:', error);
    return 0;
  }
};

export const markStaffReportsAsRead = async (reportIds: string[]) => {
  try {
    if (!reportIds.length) return { success: true };
    const response = await apiCall('/staff-reports/mark-read', {
      method: 'PUT',
      body: JSON.stringify({ reportIds }),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error marking staff reports as read:', error);
    throw error;
  }
};

export const updateStaffReport = async (id: string, reportData: { report: string; user_id: string }) => {
  try {
    const response = await apiCall(`/staff-reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    });
    return response.data || response;
  } catch (error) {
    console.error('Error updating staff report:', error);
    throw error;
  }
};

export const deleteStaffReport = async (id: string, userId: string, role: string, department: string) => {
  try {
    const response = await apiCall(`/staff-reports/${id}?user_id=${encodeURIComponent(userId)}&user_role=${encodeURIComponent(role)}&user_department=${encodeURIComponent(department)}`, {
      method: 'DELETE',
    });
    return response;
  } catch (error) {
    console.error('Error deleting staff report:', error);
    throw error;
  }
};

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
  department_id?: string | null;
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

// ============ TOURS / ONBOARDING ============

export const getCompletedTours = async (): Promise<string[]> => {
  try {
    const response = await apiCall('/tours');
    return response.data || [];
  } catch (error) {
    console.error('Error fetching completed tours:', error);
    return [];
  }
};

export const completeTour = async (tourKey: string): Promise<string[]> => {
  const response = await apiCall('/tours/complete', {
    method: 'POST',
    body: JSON.stringify({ tour_key: tourKey }),
  });
  return response.data || [];
};

export const resetTourApi = async (tourKey: string): Promise<string[]> => {
  const response = await apiCall(`/tours/${encodeURIComponent(tourKey)}`, {
    method: 'DELETE',
  });
  return response.data || [];
};

export interface BroadcastPayload {
  channel: 'push' | 'whatsapp';
  title?: string;
  message: string;
  link?: string;
  target: {
    type: 'department' | 'class' | 'role' | 'people';
    department_id?: string;
    assigned_class?: string;
    roles?: string[];
    profile_ids?: string[];
  };
}

export interface BroadcastResult {
  recipients: number;
  push?: { sent: number; fallbackToWa: number };
  whatsapp?: { queued: number };
}

export const broadcastNotification = async (payload: BroadcastPayload): Promise<BroadcastResult> => {
  const response = await apiCall('/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
};

export interface ProfileWithAssignments {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  department_id?: string;
  assigned_class?: string;
  assignments: { role: string; department?: string; department_id?: string; assigned_class?: string }[];
}

export const getProfilesWithAssignments = async (): Promise<ProfileWithAssignments[]> => {
  const response = await apiCall('/profiles/staff-assignments');
  return response.data || [];
};

export interface BroadcastHistoryItem {
  id: string;
  channel: 'push' | 'whatsapp';
  title: string | null;
  message: string;
  link: string | null;
  target_type: string;
  target_label: string;
  recipients: number;
  push_sent: number;
  wa_sent: number;
  created_at: string;
}

export const getBroadcastHistory = async (): Promise<BroadcastHistoryItem[]> => {
  const response = await apiCall('/notifications/broadcasts');
  return response.data || [];
};

export interface UserNotification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
}

export const getMyNotifications = async (): Promise<{ data: UserNotification[]; unread: number }> => {
  const response = await apiCall('/notifications/mine');
  return { data: response.data || [], unread: response.unread || 0 };
};

export const markNotificationsRead = async (ids?: string[]): Promise<void> => {
  await apiCall('/notifications/mine/read', {
    method: 'POST',
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  });
};

export interface ProfileSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  phone?: string;
}

export const searchProfiles = async (query: string): Promise<ProfileSearchResult[]> => {
  if (!query.trim()) return [];
  const response = await apiCall(`/profiles/search?q=${encodeURIComponent(query)}`);
  return response?.data || [];
};

// ============ REGISTRO DE TEMAS ============

export interface TopicRecord {
  id: string;
  company_id: number;
  department_id?: string;
  assigned_class?: string;
  created_by: string;
  fecha: string;
  tema?: string;
  base_biblica?: string;
  ensenanza_principal?: string;
  versiculo_memorizar?: string;
  actividad_practica?: string;
  estadistica_total?: number;
  estadistica_presentes_regulares?: number;
  estadistica_presentes_nuevos?: number;
  estadistica_ausentes?: number;
  firma?: string;
  observaciones?: string;
  created_at: string;
  updated_at: string;
  author?: { first_name: string; last_name: string } | null;
}

export const getTopicRecords = async (
  userId: string,
  userRole: string,
  departmentId?: string,
  assignedClass?: string
): Promise<TopicRecord[]> => {
  const params = new URLSearchParams({ user_id: userId, user_role: userRole });
  if (departmentId) params.append('department_id', departmentId);
  if (assignedClass) params.append('assigned_class', assignedClass);
  const response = await apiCall(`/topic-records?${params.toString()}`);
  return response?.data || [];
};

export const createTopicRecord = async (record: Omit<TopicRecord, 'id' | 'company_id' | 'created_at' | 'updated_at' | 'author'>): Promise<TopicRecord> => {
  const response = await apiCall('/topic-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  return response.data;
};

export const updateTopicRecord = async (id: string, record: Partial<TopicRecord>): Promise<TopicRecord> => {
  const response = await apiCall(`/topic-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(record),
  });
  return response.data;
};

export const deleteTopicRecord = async (id: string): Promise<void> => {
  await apiCall(`/topic-records/${id}`, { method: 'DELETE' });
};

// ===== Contabilidad =====
export interface AccountingTransaction {
  id: string;
  department_id: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  category: string | null;
  description: string | null;
  movement_date: string;
  created_by: string | null;
  created_at: string;
  departments?: { name: string };
  profiles?: { first_name: string; last_name: string };
}

export interface AccountingBalance {
  opening_balance: number;
  total_ingresos: number;
  total_egresos: number;
  balance: number;
}

export const getAccountingTransactions = async (params: {
  department_id: string;
  from?: string;
  to?: string;
  type?: 'ingreso' | 'egreso';
}): Promise<AccountingTransaction[]> => {
  const qs = new URLSearchParams();
  qs.set('department_id', params.department_id);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.type) qs.set('type', params.type);
  const response = await apiCall(`/accounting/transactions?${qs.toString()}`);
  return response.data || [];
};

export const createAccountingTransaction = async (tx: {
  department_id: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  category?: string | null;
  description?: string | null;
  movement_date: string;
}): Promise<AccountingTransaction> => {
  const response = await apiCall('/accounting/transactions', {
    method: 'POST',
    body: JSON.stringify(tx),
  });
  return response.data;
};

export const updateAccountingTransaction = async (
  id: string,
  tx: Partial<{
    type: 'ingreso' | 'egreso';
    amount: number;
    category: string | null;
    description: string | null;
    movement_date: string;
  }>
): Promise<AccountingTransaction> => {
  const response = await apiCall(`/accounting/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tx),
  });
  return response.data;
};

export const deleteAccountingTransaction = async (id: string): Promise<void> => {
  await apiCall(`/accounting/transactions/${id}`, { method: 'DELETE' });
};

export const getAccountingCategories = async (
  department_id: string,
  type?: 'ingreso' | 'egreso'
): Promise<string[]> => {
  const qs = new URLSearchParams();
  qs.set('department_id', department_id);
  if (type) qs.set('type', type);
  const response = await apiCall(`/accounting/categories?${qs.toString()}`);
  return response.data || [];
};

export const getAccountingBalance = async (params: {
  department_id: string;
  from?: string;
  to?: string;
}): Promise<AccountingBalance> => {
  const qs = new URLSearchParams();
  qs.set('department_id', params.department_id);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  const response = await apiCall(`/accounting/balance?${qs.toString()}`);
  return response.data;
};

export const getOpeningBalance = async (department_id: string): Promise<number> => {
  const response = await apiCall(`/accounting/opening-balance?department_id=${encodeURIComponent(department_id)}`);
  return response.data?.opening_balance ?? 0;
};

export const setOpeningBalance = async (department_id: string, opening_balance: number): Promise<void> => {
  await apiCall('/accounting/opening-balance', {
    method: 'PUT',
    body: JSON.stringify({ department_id, opening_balance }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Grupos pequeños

export type SmallGroup = {
  id: string;
  company_id: number;
  name: string;
  description: string | null;
  category: string | null;
  requires_approval: boolean;
  capacity: number | null;
  frequency: string | null;
  weekday: number | null;
  meeting_time: string | null;
  location: string | null;
  status: 'active' | 'inactive' | 'archived';
  department_id: string | null;
  created_by: string | null;
  created_at: string;
  member_count?: number;
  leaders?: { id: string; first_name: string; last_name: string | null; role_in_group: 'leader' | 'co_leader' }[];
};

export type SmallGroupMember = {
  id: string;
  role_in_group: 'leader' | 'co_leader' | 'member';
  status: 'pending' | 'active' | 'rejected' | 'left';
  requested_at: string | null;
  approved_at: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string | null; phone: string | null } | null;
  profile: { id: string; first_name: string; last_name: string | null; phone: string | null; email: string | null } | null;
};

export type SmallGroupMeeting = {
  id: string;
  group_id: string;
  meeting_date: string;
  notes: string | null;
  created_at: string;
};

export type SmallGroupAttendanceRow = SmallGroupMember & { present: boolean | null };

export const getSmallGroups = async (status: 'active' | 'archived' = 'active'): Promise<SmallGroup[]> => {
  const res = await apiCall(`/small-groups?status=${status}`);
  return res.data || [];
};

export const getSmallGroup = async (id: string): Promise<SmallGroup> => {
  const res = await apiCall(`/small-groups/${id}`);
  return res.data;
};

export const createSmallGroup = async (data: {
  name: string;
  description?: string;
  category?: string;
  requires_approval?: boolean;
  capacity?: number;
  frequency?: string;
  weekday?: number;
  meeting_time?: string;
  location?: string;
  leader_profile_id?: string;
  department_id?: string;
}): Promise<SmallGroup> => {
  const res = await apiCall('/small-groups', { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const updateSmallGroup = async (id: string, data: Partial<SmallGroup>): Promise<SmallGroup> => {
  const res = await apiCall(`/small-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  return res.data;
};

export const archiveSmallGroup = async (id: string): Promise<void> => {
  await apiCall(`/small-groups/${id}`, { method: 'DELETE' });
};

export const getSmallGroupMembers = async (groupId: string): Promise<SmallGroupMember[]> => {
  const res = await apiCall(`/small-groups/${groupId}/members`);
  return res.data || [];
};

export const addSmallGroupMember = async (groupId: string, data: {
  role_in_group?: 'leader' | 'co_leader' | 'member';
  profile_id?: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: string;
}): Promise<SmallGroupMember> => {
  const res = await apiCall(`/small-groups/${groupId}/members`, { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const updateSmallGroupMember = async (groupId: string, memberId: string, data: {
  role_in_group?: 'leader' | 'co_leader' | 'member';
  status?: 'pending' | 'active' | 'rejected' | 'left';
}): Promise<SmallGroupMember> => {
  const res = await apiCall(`/small-groups/${groupId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(data) });
  return res.data;
};

export const removeSmallGroupMember = async (groupId: string, memberId: string): Promise<void> => {
  await apiCall(`/small-groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
};

export const getSmallGroupMeetings = async (groupId: string): Promise<SmallGroupMeeting[]> => {
  const res = await apiCall(`/small-groups/${groupId}/meetings`);
  return res.data || [];
};

export const createSmallGroupMeeting = async (groupId: string, data: { meeting_date: string; notes?: string }): Promise<SmallGroupMeeting> => {
  const res = await apiCall(`/small-groups/${groupId}/meetings`, { method: 'POST', body: JSON.stringify(data) });
  return res.data;
};

export const getSmallGroupAttendance = async (groupId: string, meetingId: string): Promise<SmallGroupAttendanceRow[]> => {
  const res = await apiCall(`/small-groups/${groupId}/meetings/${meetingId}/attendance`);
  return res.data || [];
};

export const saveSmallGroupAttendance = async (
  groupId: string,
  meetingId: string,
  records: { member_id: string; present: boolean }[]
): Promise<void> => {
  await apiCall(`/small-groups/${groupId}/meetings/${meetingId}/attendance`, {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
};
