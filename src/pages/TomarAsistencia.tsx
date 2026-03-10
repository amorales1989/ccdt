import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, UserX, Calendar, Users, CheckCircle2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { markAttendance, getAttendance } from "@/lib/api";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
          if (!error && data) setDepartmentId(data.id);
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
          if (!error && data) {
            const authStudents: Record<string, boolean> = {};
            data.forEach((auth: any) => {
              if (auth.student_id) authStudents[auth.student_id] = true;
            });
            setAuthorizedStudents(authStudents);
          }
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
      let departmentQuery = supabase.from("students").select("*, departments:department_id(name, id)");

      if (!isAdminOrSecretaria) {
        if (!departmentId) return [];
        departmentQuery = departmentQuery.eq("department_id", departmentId);
        if (userClass) departmentQuery = departmentQuery.eq("assigned_class", userClass);
      }

      const { data: departmentStudents, error } = await departmentQuery;
      if (error) throw error;

      let allStudents = [...departmentStudents];

      if (!isAdminOrSecretaria && departmentId) {
        const { data: authorizedData, error: authError } = await supabase
          .from("student_authorizations")
          .select("*, student:student_id(*)")
          .eq("department_id", departmentId);

        if (!authError && authorizedData) {
          const existingIds = new Set(departmentStudents.map(s => s.id));
          const authStudents = authorizedData
            .filter((a: any) => a.student && !existingIds.has(a.student.id))
            .map((a: any) => ({ ...a.student, is_authorized: true }));
          allStudents = [...departmentStudents, ...authStudents];
        }
      }

      return allStudents.sort((a, b) => {
        const gA = (a.gender || '').toLowerCase();
        const gB = (b.gender || '').toLowerCase();
        if (gA !== gB) {
          if (gA === "femenino") return -1;
          if (gB === "femenino") return 1;
        }
        return (a.first_name || '').localeCompare(b.first_name || '');
      });
    },
    enabled: Boolean(profile) && (!isAdminOrSecretaria || Boolean(departmentId)),
  });

  const regularStudents = students?.filter(s => !s.nuevo) || [];
  const newStudents = students?.filter(s => s.nuevo === true) || [];
  const hasNewStudents = newStudents.length > 0;

  const presentCount = Object.values(asistencias).filter(Boolean).length;
  const absentCount = students.length - presentCount;

  const getFullName = (student: any) =>
    student.last_name ? `${student.first_name} ${student.last_name}` : student.first_name;

  const isAuthorizedStudent = (student: any) =>
    student.is_authorized || authorizedStudents[student.id];

  const marcarAsistencia = (id: string, presente: boolean) => {
    setAsistencias(prev => ({ ...prev, [id]: presente }));
  };

  const checkExistingAttendance = async (date: string) => {
    try {
      const data = await getAttendance(date, date, undefined, departmentId);
      return data && data.length > 0;
    } catch {
      return false;
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast({ title: "Error", description: "Por favor seleccione una fecha", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const hasExisting = await checkExistingAttendance(selectedDate);
      if (hasExisting) { setShowAlert(true); setIsLoading(false); return; }

      const adjustedDate = format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd");
      const defaultAbsent: Record<string, boolean> = {};
      students.forEach(s => { defaultAbsent[s.id] = false; });
      const finalAttendances = { ...defaultAbsent, ...asistencias };

      await Promise.all(
        Object.entries(finalAttendances).map(([studentId, status]) => {
          const student = students.find(s => s.id === studentId);
          return markAttendance({
            student_id: studentId,
            date: adjustedDate,
            status,
            department_id: departmentId || undefined,
            assigned_class: student?.assigned_class || userClass || "",
          });
        })
      );

      toast({ title: "Asistencia guardada", description: "Registrada exitosamente", variant: "success" });
      setAsistencias({});
    } catch {
      toast({ title: "Error", description: "Hubo un error al guardar la asistencia", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdminOrSecretaria && !currentDepartment) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-bold text-foreground mb-2">Sin departamento asignado</h3>
          <p className="text-sm text-muted-foreground">No tiene departamentos asignados. Contacte al administrador.</p>
        </div>
      </div>
    );
  }

  if (isLoadingStudents) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="glass-card h-16 animate-pulse opacity-50" />
        ))}
      </div>
    );
  }

  const displayDate = format(addDays(new Date(selectedDate), 1), "EEEE, dd 'de' MMMM yyyy", { locale: es });

  const renderStudentCard = (student: any) => {
    const isPresent = asistencias[student.id];
    const isMarked = student.id in asistencias;
    const isFemale = (student.gender || '').toLowerCase() === 'femenino';
    const isAuthorized = isAuthorizedStudent(student);

    return (
      <div
        key={student.id}
        className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200 animate-slide-in"
      >
        {/* Gender dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isFemale ? 'bg-pink-400' : 'bg-blue-400'}`} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-800 truncate block">
            {getFullName(student)}
          </span>
          <div className="flex gap-1.5 mt-0.5 flex-wrap">
            {isAuthorized && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-none font-bold">
                Autorizado
              </Badge>
            )}
            {student.nuevo && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-none font-bold">
                Nuevo
              </Badge>
            )}
          </div>
        </div>

        {/* Single attendance toggle */}
        <button
          onClick={() => marcarAsistencia(student.id, !asistencias[student.id])}
          className={`w-10 h-10 rounded-xl font-black text-sm transition-all duration-200 shrink-0 ${asistencias[student.id]
              ? 'bg-green-500 text-white shadow-md shadow-green-200 scale-105'
              : 'bg-red-100 text-red-500 hover:bg-red-200'
            }`}
        >
          {asistencias[student.id] ? 'P' : 'A'}
        </button>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28">

        {/* Page Header */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight mb-1">
            Tomar Asistencia
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{displayDate}</p>
        </div>

        {/* Stats + Date row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Stats pill */}
          <div className="glass-card flex items-center gap-4 px-5 py-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-black text-green-600 leading-none">{presentCount}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Presentes</div>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <UserX className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <div className="text-lg font-black text-red-500 leading-none">{absentCount}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ausentes</div>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-lg font-black text-primary leading-none">{students.length}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</div>
              </div>
            </div>
          </div>

          {/* Date picker */}
          <div className="glass-card flex items-center gap-3 px-4 py-3 sm:w-auto">
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-gray-700 border-none outline-none w-full"
            />
          </div>
        </div>

        {/* Student List */}
        {students.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No hay alumnos en este departamento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Section label */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                Alumnos · {regularStudents.length}
              </div>
            </div>

            {regularStudents.map(renderStudentCard)}

            {/* New students separator */}
            {hasNewStudents && (
              <>
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    Nuevos Alumnos · {newStudents.length}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {newStudents.map(renderStudentCard)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/90 to-transparent">
        <Button
          onClick={handleSaveAttendance}
          disabled={isLoading || !selectedDate || students.length === 0}
          className="w-full h-12 button-gradient shadow-xl shadow-primary/20 font-bold text-base rounded-2xl"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Guardar Asistencia
            </div>
          )}
        </Button>
      </div>

      {/* Alert Dialog */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent className="glass-card border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="h-6 w-6 text-orange-500" />
            </div>
            <AlertDialogTitle className="text-center font-black text-foreground">
              Asistencia ya registrada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Ya existe un registro para el{" "}
              <strong>{format(addDays(new Date(selectedDate), 1), "dd/MM/yyyy")}</strong> en este departamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction
              onClick={() => setShowAlert(false)}
              className="button-gradient px-8 rounded-xl"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TomarAsistencia;