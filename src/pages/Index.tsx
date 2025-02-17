import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DepartmentType } from "@/types/database";

const Index = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const { data, error } = await supabase.from("students").select("*");
        if (error) throw error;
        setStudents(data);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const renderStudentStats = () => {
    if (!profile) return null;

    const isAdminOrSecretary = ["admin", "secretaria"].includes(profile.role);
    const userDepartments = profile.departments || [];

    // Group students by department
    const studentsByDepartment = [
      "escuelita_central",
      "pre_adolescentes",
      "adolescentes",
      "jovenes",
      "jovenes_adultos",
      "adultos"
    ].reduce((acc, dept) => {
      // Solo procesar departamentos relevantes para el usuario
      if (!isAdminOrSecretary && !userDepartments.includes(dept as DepartmentType)) {
        return acc;
      }

      const deptStudents = students.filter(s => s.department === dept);
      acc[dept] = {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
      return acc;
    }, {} as Record<string, { male: number; female: number; total: number }>);

    return (
      <div>
        {Object.entries(studentsByDepartment).map(([dept, stats]) => (
          <div key={dept}>
            <h3>{dept}</h3>
            <p>Varones: {stats.male}</p>
            <p>Mujeres: {stats.female}</p>
            <p>Total: {stats.total}</p>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div>
      <h1>Estadísticas de Alumnos</h1>
      {renderStudentStats()}
    </div>
  );
};

export default Index;
