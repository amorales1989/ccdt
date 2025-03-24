
import { supabase } from "@/integrations/supabase/client";
import type { Student, Event, Attendance, Department, Company, Profile } from "@/types/database";

// Students
export const getStudents = async () => {
  const { data, error } = await supabase
    .from('students')
    .select('*, departments(name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching students:", error);
    throw error;
  }
  return data as Student[];
};

export const getStudent = async (id: string) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching student:", error);
    throw error;
  }
  return data as Student;
};

export const createStudent = async (student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single();

  if (error) {
    console.error("Error creating student:", error);
    throw error;
  }
  return data as Student;
};

export const updateStudent = async (id: string, updates: Partial<Student>) => {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating student:", error);
    throw error;
  }
  return data as Student;
};

export const deleteStudent = async (id: string) => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting student:", error);
    throw error;
  }
  return true;
};

// Check if a DNI already exists in the system
export const checkDniExists = async (dni: string) => {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('document_number', dni)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 means "no rows returned" - which is what we want
    console.error("Error checking DNI:", error);
    throw error;
  }

  return data !== null;
};

// Events
export const getEvents = async () => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
  return data as Event[];
};

export const createEvent = async (event: Omit<Event, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw error;
  }
  return data as Event;
};

export const updateEvent = async (id: string, updates: Partial<Event>) => {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating event:", error);
    throw error;
  }
  return data as Event;
};

export const deleteEvent = async (id: string) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
  return true;
};

// Attendance
export const getAttendance = async (startDate?: string, endDate?: string, studentId?: string, departmentId?: string) => {
  let query = supabase
    .from('attendance')
    .select('*, students:student_id(name, departments:department_id(name)), departments:department_id(name)');

  if (startDate && endDate) {
    query = query.gte('date', startDate).lte('date', endDate);
  }

  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    console.error("Error fetching attendance:", error);
    throw error;
  }
  return data as Attendance[];
};

export const markAttendance = async (attendance: {
  student_id: string;
  date: string;
  status: boolean;
  department_id?: string;
  assigned_class?: string;
  event_id?: string;
}) => {
  // Check if an attendance record already exists for this student on this date
  const { data: existingRecord, error: fetchError } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', attendance.student_id)
    .eq('date', attendance.date)
    .maybeSingle();

  if (fetchError) {
    console.error("Error checking existing attendance:", fetchError);
    throw fetchError;
  }

  if (existingRecord) {
    // Update existing record
    const { data, error } = await supabase
      .from('attendance')
      .update({
        status: attendance.status,
        department_id: attendance.department_id,
        assigned_class: attendance.assigned_class,
        event_id: attendance.event_id
      })
      .eq('id', existingRecord.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating attendance:", error);
      throw error;
    }
    return data as Attendance;
  } else {
    // Create new record
    const { data, error } = await supabase
      .from('attendance')
      .insert(attendance)
      .select()
      .single();

    if (error) {
      console.error("Error creating attendance:", error);
      throw error;
    }
    return data as Attendance;
  }
};

export const createAttendance = async (attendance: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('attendance')
    .insert(attendance)
    .select()
    .single();

  if (error) {
    console.error("Error creating attendance:", error);
    throw error;
  }
  return data as Attendance;
};

export const updateAttendance = async (id: string, updates: Partial<Attendance>) => {
  const { data, error } = await supabase
    .from('attendance')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating attendance:", error);
    throw error;
  }
  return data as Attendance;
};

export const deleteAttendance = async (id: string) => {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting attendance:", error);
    throw error;
  }
  return true;
};

// Departments
export const getDepartments = async () => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    throw error;
  }
  return data as Department[];
};

export const getDepartmentByName = async (name: string) => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    console.error("Error fetching department by name:", error);
    throw error;
  }
  return data as Department;
};

export const createDepartment = async (department: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('departments')
    .insert(department)
    .select()
    .single();

  if (error) {
    console.error("Error creating department:", error);
    throw error;
  }
  return data as Department;
};

export const updateDepartment = async (id: string, updates: Partial<Department>) => {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating department:", error);
    throw error;
  }
  return data as Department;
};

export const deleteDepartment = async (id: string) => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting department:", error);
    throw error;
  }
  return true;
};

// Company
export const getCompany = async (id: number) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching company:", error);
    throw error;
  }
  return data as Company;
};

export const updateCompany = async (id: number, updates: Partial<Company>) => {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating company:", error);
    throw error;
  }
  return data as Company;
};

// Profiles
export const getProfiles = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error("Error fetching profiles:", error);
    throw error;
  }
  return data as Profile[];
};

export const updateProfile = async (id: string, updates: Partial<Profile>) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
  return data as Profile;
};

// Notification functions
export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getUserNotifications = async (userId: string) => {
  // Get all notifications
  const { data: allNotifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('*, departments(name)')
    .order('created_at', { ascending: false });

  if (notificationsError) throw notificationsError;

  if (!allNotifications || allNotifications.length === 0) {
    return [];
  }

  // Get all read notifications for this user
  const { data: readNotifications, error: readError } = await supabase
    .from('notifications_read')
    .select('notification_id')
    .eq('user_id', userId);

  if (readError) throw readError;

  // Create a set of read notification IDs for quick lookup
  const readNotificationIds = new Set(
    (readNotifications || []).map((item) => item.notification_id)
  );

  // Get user's profile to check department and class
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('departments, department_id, assigned_class')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    // If error is not "No rows found", throw it
    throw profileError;
  }

  // Filter notifications that are either:
  // - Sent to all users
  // - Sent to user's department
  // - Sent to user's class
  // - Sent to user's department and class
  return allNotifications
    .filter((notification) => {
      if (notification.send_to_all) {
        return true;
      }

      if (!profile) {
        return false;
      }

      const userDepartmentId = profile.department_id;
      const userClass = profile.assigned_class;

      if (notification.department_id && notification.assigned_class) {
        // Both department and class must match
        return (
          notification.department_id === userDepartmentId &&
          notification.assigned_class === userClass
        );
      } else if (notification.department_id) {
        // Only department must match
        return notification.department_id === userDepartmentId;
      } else if (notification.assigned_class) {
        // Only class must match
        return notification.assigned_class === userClass;
      }

      return false;
    })
    .map((notification) => ({
      ...notification,
      is_read: readNotificationIds.has(notification.id),
    }));
};

export const createNotification = async (notification: {
  title: string;
  content: string;
  department_id?: string;
  assigned_class?: string;
  send_to_all?: boolean;
}) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteNotification = async (id: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const { error } = await supabase
    .from('notifications_read')
    .insert({
      notification_id: notificationId,
      user_id: userId,
    })
    .single();

  if (error && error.code !== '23505') {
    // Ignore unique violation errors (notification already marked as read)
    throw error;
  }

  return true;
};
