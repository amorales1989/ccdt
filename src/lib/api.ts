import { supabase } from "@/integrations/supabase/client";
import type { Attendance } from "@/types/database";

export const getAttendance = async (): Promise<Attendance[]> => {
  try {
    let { data: attendances, error } = await supabase
      .from('attendance')
      .select(`
        *,
        students (
          id,
          first_name,
          last_name,
          deleted_at,
          departments (name)
        )
      `);

    if (error) throw error;

    // Transform the data to include all required fields
    const formattedAttendances = attendances?.map(attendance => {
      const student = attendance.students;
      return {
        ...attendance,
        students: {
          ...student,
          department: student?.departments?.name || '',
          is_deleted: !!student?.deleted_at,
          name: `${student?.first_name} ${student?.last_name}`,
          gender: null, // Add default values for required fields
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
