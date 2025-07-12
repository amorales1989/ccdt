import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UserCheck, UserX } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { markAttendance, getAttendance } from "@/lib/api";
import { format, addDays, compareAsc } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const TomarAsistencia = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [asistencias, setAsistencias] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [authorizedStudents, setAuthorizedStudents] = useState<Record<string, boolean>>({});

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";
  const currentDepartment = profile?.departments?.[0];
  const userClass = profile?.assigned_class;


  useEffect(() => {
    const fetchDepartmentId = async () => {
      if (currentDepartment) {
        try {
          const { data, error } = await supabase
            .from("departments")
            .select("id")
            .eq("name", currentDepartment)
            .single();

          if (error) {
            console.error("Error fetching department ID:", error);
            return;
          }

          if (data) {
            setDepartmentId(data.id);
          }
        } catch (error) {
          console.error("Error in fetchDepartmentId:", error);
        }
      }
    };

    fetchDepartmentId();
  }, [currentDepartment]);

  useEffect(() => {
    const fetchAuthorizedStudents = async () => {
      if (departmentId) {
        try {
          const { data, error } = await supabase
            .from("student_authorizations")
            .select("student_id")
            .eq("department_id", departmentId);

          if (error) {
            console.error("Error fetching authorized students:", error);
            return;
          }

          const authStudents: Record<string, boolean> = {};
          if (data) {
            data.forEach((auth: any) => {
              if (auth.student_id) {
                authStudents[auth.student_id] = true;
              }
            });
          }

          setAuthorizedStudents(authStudents);
        } catch (error) {
          console.error("Error in fetchAuthorizedStudents:", error);
        }
      }
    };

    fetchAuthorizedStudents();
  }, [departmentId]);

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students-attendance", departmentId, userClass],
    queryFn: async () => {

      let departmentQuery = supabase
        .from("students")
        .select("*, departments:department_id(name, id)");

      if (!isAdminOrSecretaria) {
        if (!departmentId) {
          return [];
        }

        departmentQuery = departmentQuery.eq("department_id", departmentId);

        if (userClass) {
          departmentQuery = departmentQuery.eq("assigned_class", userClass);
        }
      }

      const { data: departmentStudents, error } = await departmentQuery;
      if (error) {
        console.error("Error fetching students for attendance:", error);
        throw error;
      }

      let allStudents = [...departmentStudents];

      if (!isAdminOrSecretaria && departmentId) {
        const { data: authorizedData, error: authError } = await supabase
          .from("student_authorizations")
          .select("*, student:student_id(*)")
          .eq("department_id", departmentId);

        if (authError) {
          console.error("Error fetching authorized students:", authError);
        } else if (authorizedData) {
          const existingIds = new Set(departmentStudents.map(s => s.id));
          const authorizedStudents = authorizedData
            .filter((a: any) => a.student && !existingIds.has(a.student.id))
            .map((a: any) => ({
              ...a.student,
              is_authorized: true
            }));

          allStudents = [...departmentStudents, ...authorizedStudents];
        }
      }

      allStudents.sort((a, b) => {
        const genderA = (a.gender || '').toLowerCase();
        const genderB = (b.gender || '').toLowerCase();

        if (genderA !== genderB) {
          if (genderA === "femenino") return -1;
          if (genderB === "femenino") return 1;
          return genderA.localeCompare(genderB);
        }

        // Now sorting by first name first, then last name if needed
        const firstNameA = (a.first_name || '').toLowerCase();
        const firstNameB = (b.first_name || '').toLowerCase();

        if (firstNameA !== firstNameB) {
          return firstNameA.localeCompare(firstNameB);
        }

        // If first names are the same, sort by last name
        const lastNameA = (a.last_name || '').toLowerCase();
        const lastNameB = (b.last_name || '').toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      });

      return allStudents;
    },
    enabled: Boolean(profile) && (!isAdminOrSecretaria || Boolean(departmentId)),
  });

  // Separar alumnos en dos grupos: normales y nuevos
  const regularStudents = students?.filter(student => !student.nuevo) || [];
  const newStudents = students?.filter(student => student.nuevo === true) || [];
  const hasNewStudents = newStudents.length > 0;

  // Cálculo de estadísticas de asistencia
  const attendanceStats = {
    present: Object.values(asistencias).filter(status => status).length,
    absent: students.length - Object.values(asistencias).filter(status => status).length
  };
  
  const getFullName = (student: any): string => {
    if (student.last_name) {
      return `${student.first_name} ${student.last_name}`;
    } else {
      return student.first_name;
    }
  };

  const checkExistingAttendance = async (date: string) => {
    try {

      const attendanceData = await getAttendance(date, date, undefined, departmentId);
      const hasAttendance = attendanceData && attendanceData.length > 0;

      return hasAttendance;
    } catch (error) {
      console.error("Error checking existing attendance:", error);
      return false;
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Por favor seleccione una fecha",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const hasExistingAttendance = await checkExistingAttendance(selectedDate);

      if (hasExistingAttendance) {
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      const adjustedDate = format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd");

      // Create a default attendance record for each student (all set to absent by default)
      const defaultAbsentAttendance: Record<string, boolean> = {};
      students.forEach(student => {
        defaultAbsentAttendance[student.id] = false;
      });

      // Only override the default with explicitly marked presence
      const finalAttendances = { ...defaultAbsentAttendance, ...asistencias };

      console.log("Saving attendance data:", finalAttendances);

      await Promise.all(
        Object.entries(finalAttendances).map(([studentId, status]) => {
          const student = students.find(s => s.id === studentId);
          const studentClass = student?.assigned_class || userClass || "";

          return markAttendance({
            student_id: studentId,
            date: adjustedDate,
            status: status,
            department_id: departmentId || undefined,
            assigned_class: studentClass,
          });
        })
      );

      toast({
        title: "Asistencia guardada",
        description: "La asistencia ha sido registrada exitosamente",
        variant: "success",
      });

      setAsistencias({});
    } catch (error) {
      console.error("Error al guardar asistencia:", error);
      toast({
        title: "Error",
        description: "Hubo un error al guardar la asistencia",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const marcarAsistencia = (id: string, presente: boolean) => {
    setAsistencias((prev) => ({ ...prev, [id]: presente }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const isAuthorizedStudent = (student: any) => {
    return student.is_authorized || authorizedStudents[student.id];
  };

  // Función para renderizar una fila de alumno
  const renderStudentRow = (student: any) => (
    <TableRow 
      key={student.id} 
      className={`
        ${isAuthorizedStudent(student) ? "bg-green-50" : ""} 
        ${student.nuevo ? "bg-blue-50" : ""}
      `}
    >
      <TableCell className="flex items-center gap-2">
        {getFullName(student)}
        {isAuthorizedStudent(student) && (
          <Badge variant="outline" className="bg-green-50 text-green-700 ml-2 flex items-center gap-1">
            <UserCheck className="h-3 w-3" />
            Autorizado
          </Badge>
        )}
        {student.nuevo && (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 ml-2">
            Nuevo
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => marcarAsistencia(student.id, !asistencias[student.id])}
            className={`font-bold ${asistencias[student.id]
              ? "bg-green-500 hover:bg-green-600 text-white border-green-500"
              : "bg-red-500 hover:bg-red-600 text-white border-red-500"
              }`}
          >
            {asistencias[student.id] ? "P" : "A"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  if (!isAdminOrSecretaria && !currentDepartment) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tiene departamentos asignados. Contacte al administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingStudents) {
    return <div className="p-6">Cargando alumnos...</div>;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Tomar Asistencia - {format(addDays(new Date(selectedDate), 1), "dd/MM/yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border p-2 rounded w-full [&::-webkit-datetime-edit]:-ml-0.5 [&::-webkit-calendar-picker-indicator]:opacity-100"
            style={{ WebkitAppearance: 'textfield' }}
          />
          <div className="flex justify-center items-center gap-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <span>Presentes: {attendanceStats.present}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              <span>Ausentes: {attendanceStats.absent}</span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="text-black">
                <TableHead>Nombre</TableHead>
                <TableHead>Asistencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Renderizar alumnos regulares */}
              {regularStudents.map((student) => renderStudentRow(student))}
              
              {/* Línea separadora y alumnos nuevos */}
              {hasNewStudents && (
                <>
                  <TableRow>
                    <TableCell colSpan={2} className="py-4">
                      <div className="flex items-center justify-center">
                        <div className="flex-grow border-t border-gray-300"></div>
                        <span className="mx-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          Nuevos Alumnos
                        </span>
                        <div className="flex-grow border-t border-gray-300"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                  {newStudents.map((student) => renderStudentRow(student))}
                </>
              )}
            </TableBody>
          </Table>
          <Button
            onClick={handleSaveAttendance}
            className="w-full"
            disabled={isLoading || !selectedDate || students.length === 0}
          >
            {isLoading ? "Guardando..." : "Guardar Asistencia"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asistencia ya registrada</AlertDialogTitle>
            <AlertDialogDescription>
              Ya existe un registro de asistencia para la fecha {format(addDays(new Date(selectedDate), 1), "dd/MM/yyyy")} en este departamento.
              Por favor, seleccione otra fecha o consulte el historial de asistencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAlert(false)}>Aceptar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TomarAsistencia;