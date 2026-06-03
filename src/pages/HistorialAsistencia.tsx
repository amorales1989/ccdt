import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { getAttendance, getDepartmentByName, getDepartments, getStudents } from "@/lib/api";
import { Download, Search, UserCheck, UserX, Calendar as CalendarIcon, PenSquare, Check, X, Save, MoreVertical, PersonStanding, CheckCircle2, Users, Trash2 } from "lucide-react";
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
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";
import { DatePickerField } from "@/components/DatePickerField";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Attendance } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { markAttendance, deleteAttendanceByDate } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { TourGuide } from "@/components/TourGuide";
import { HelpCircle } from "lucide-react";
import type { Step } from "react-joyride";

const dateRangeOptions = [
  { label: "Hoy", value: "today" },
  { label: "Últimos 7 días", value: "7days" },
  { label: "Este mes", value: "thisMonth" },
  { label: "Rango personalizado", value: "custom" }
];


const getFullName = (student: any): string => {
  if (!student) return "Miembro eliminado";

  return student.last_name
    ? `${student.first_name} ${student.last_name}`
    : student.first_name;
};

const HistorialAsistencia = () => {
  const [selectedRange, setSelectedRange] = useState("today");
  const [runTour, setRunTour] = useState<boolean | undefined>(undefined);
  const tourSteps: Step[] = [
    { target: '[data-tour="hist-header"]', content: "Consultá las asistencias registradas en cualquier período.", disableBeacon: true },
    { target: '[data-tour="hist-kpis"]', content: "Resumen rápido: cuántos asistieron, faltaron y total de registros." },
    { target: '[data-tour="hist-filtros"]', content: "Cambiá el rango de fechas, departamento o clase para filtrar los datos." },
    { target: '[data-tour="hist-edit"]', content: "Si necesitás corregir asistencias pasadas, entrá en modo Edición." },
  ];
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [singleDateOpen, setSingleDateOpen] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editRecords, setEditRecords] = useState<Attendance[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAttendance, setDeletingAttendance] = useState(false);

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const isDirector = profile?.role === 'director' || profile?.role === 'vicedirector';
  const userDepartment = profile?.departments?.[0];
  const userDepartmentId = profile?.department_id;
  const userClass = profile?.assigned_class;

  const { data: departmentData } = useQuery({
    queryKey: ['department', selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment !== "all") {
        return await getDepartmentByName(selectedDepartment as DepartmentType);
      }
      return null;
    },
    enabled: selectedDepartment !== "all"
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments
  });

  const availableClasses = departmentData?.classes || [];

  useEffect(() => {
    if ((isDirector || !isAdminOrSecretaria) && userDepartment) {
      setSelectedDepartment(userDepartment);
      if (!isDirector && userClass) {
        setSelectedClass(userClass);
      }
    }
  }, [isAdminOrSecretaria, isDirector, userDepartment, userClass]);

  const handleDateRangeChange = (value: string) => {
    setSelectedRange(value);
    const today = new Date();

    switch (value) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        setSelectedDate(today);
        break;
      case "7days":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        setSelectedDate(today);
        break;
      case "thisMonth":
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        setSelectedDate(today);
        break;
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      if (date > endDate) {
        setEndDate(date);
      }
      setSelectedRange("custom");
      setStartDateOpen(false);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      setEndDate(date);
      setSelectedRange("custom");
      if (date < startDate) setStartDate(date);
      setEndDateOpen(false);
    }
  };

  const handleSingleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setStartDate(date);
      setEndDate(date);
      setSelectedRange("custom");
      setSingleDateOpen(false);
    }
  };

  const { data: attendance = [], isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), selectedDepartment, selectedClass, userDepartmentId, refreshTrigger],
    queryFn: async () => {
      const actualStartDate = startDate > endDate ? endDate : startDate;
      const actualEndDate = endDate < startDate ? startDate : endDate;

      const formattedStartDate = format(actualStartDate, "yyyy-MM-dd");
      const formattedEndDate = format(actualEndDate, "yyyy-MM-dd");

      let departmentIdToUse = null;

      if (isAdminOrSecretaria) {
        if (selectedDepartment !== "all") {
          const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
          if (departmentData && departmentData.id) {
            departmentIdToUse = departmentData.id;
          }
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }

      if (isDirector && selectedClass === "all") {
        return [];
      }

      const attendanceData = await getAttendance(
        formattedStartDate,
        formattedEndDate,
        "",
        departmentIdToUse,
        selectedClass !== "all" ? selectedClass : undefined
      );

      if (selectedClass !== "all") {
        return attendanceData.filter(record => record.assigned_class === selectedClass);
      }

      return attendanceData;
    },
  });

  const { data: dateAttendance = [], isLoading: dateAttendanceLoading, refetch: refetchDateAttendance } = useQuery({
    queryKey: ["date-attendance", editDate ? format(editDate, "yyyy-MM-dd") : "", userDepartmentId, userClass, selectedDepartment, selectedClass],
    queryFn: async () => {
      if (!editDate) return [];
      const formattedDate = format(editDate, "yyyy-MM-dd");
      let departmentIdToUse = null;
      if (isAdminOrSecretaria && selectedDepartment !== "all") {
        const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
        if (departmentData && departmentData.id) {
          departmentIdToUse = departmentData.id;
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      const classToFilter = (isAdminOrSecretaria || isDirector) && selectedClass !== "all"
        ? selectedClass
        : (!isAdminOrSecretaria && !isDirector ? (userClass || "") : undefined);
      const attendanceData = await getAttendance(formattedDate, formattedDate, "", departmentIdToUse, classToFilter);
      if ((isAdminOrSecretaria || isDirector) && selectedClass !== "all") {
        return attendanceData.filter(record => record.assigned_class === selectedClass);
      } else if (!isAdminOrSecretaria && !isDirector) {
        return attendanceData.filter(record => record.assigned_class === (userClass || ""));
      }
      return attendanceData;
    },
    enabled: isEditMode && !!editDate
  });

  const { data: departmentStudents = [], isLoading: isLoadingDepartmentStudents } = useQuery({
    queryKey: ["students-for-attendance", userDepartmentId, selectedDepartment, selectedClass, userClass],
    queryFn: async () => {
      let departmentIdToUse = null;
      if (isAdminOrSecretaria && selectedDepartment !== "all") {
        const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
        if (departmentData && departmentData.id) {
          departmentIdToUse = departmentData.id;
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      if (!departmentIdToUse) return [];

      // Clase a filtrar segun rol
      const classToFilter = (isAdminOrSecretaria || isDirector) ? selectedClass : userClass;

      // Usar getStudents (junction-aware) para traer el roster completo del depto+clase,
      // igual que TomarAsistencia. La query directa a 'students' por columnas legacy
      // omitia alumnos inscriptos via student_departments.
      const params: Record<string, string> = { department_id: departmentIdToUse };
      if (classToFilter && classToFilter !== "all") params.assigned_class = classToFilter;

      const students = await getStudents(params) || [];

      // Excluir maestros/colaboradores/auxiliares cuando la clase no es Obreros
      const isObrerosView = (classToFilter || '').toLowerCase() === 'obreros';
      const onlyAlumnos = (!isObrerosView && classToFilter && classToFilter !== 'all')
        ? (students as any[]).filter((s: any) => {
            const assigns = s.dept_assignments || [];
            const match = assigns.find((a: any) =>
              a.department_id === departmentIdToUse &&
              (a.assigned_class || '').toLowerCase() === (classToFilter || '').toLowerCase()
            );
            if (!match) return true;
            const role = (match.role_in_dept || 'alumno').toLowerCase();
            return role === 'alumno';
          })
        : (students as any[]);

      // Normalizar department_id/assigned_class al contexto editado para los registros virtuales
      return onlyAlumnos.map((s: any) => ({
        ...s,
        department_id: departmentIdToUse,
        assigned_class: (classToFilter && classToFilter !== "all") ? classToFilter : s.assigned_class,
      }));
    },
    enabled: isEditMode && Boolean(userDepartmentId || (isAdminOrSecretaria && selectedDepartment !== "all"))
  });

  useEffect(() => {
    if (isEditMode && departmentStudents && departmentStudents.length > 0) {
      const mergedRecords = departmentStudents.map(student => {
        // Buscar si ya existe un registro de asistencia para este estudiante en esta fecha
        const existingRecord = dateAttendance?.find(r => r.student_id === student.id);

        if (existingRecord) {
          // Si existe, lo usamos pero nos aseguramos de que el objeto student esté actualizado
          return { ...existingRecord, students: student };
        } else {
          // Si no existe (es un miembro nuevo o no se tomó asistencia para él), 
          // creamos un registro "virtual" (ausente por defecto)
          return {
            id: `temp-${student.id}`,
            student_id: student.id,
            date: format(editDate, "yyyy-MM-dd"),
            status: false,
            department_id: student.department_id,
            assigned_class: student.assigned_class,
            students: student,
          } as any;
        }
      });
      setEditRecords(mergedRecords);
    } else if (isEditMode && departmentStudents && departmentStudents.length === 0 && !isLoadingDepartmentStudents) {
      setEditRecords([]);
    }
  }, [dateAttendance, departmentStudents, isEditMode, editDate, isLoadingDepartmentStudents]);

  const handleEditDateSelect = (date: Date | undefined) => {
    if (date) {
      setEditRecords([]); // Limpiar registros previos al cambiar de fecha
      setEditDate(date);
      setEditDateOpen(false);
      refetchDateAttendance();
    }
  };

  const toggleAttendanceStatus = (id: string) => {
    setEditRecords(prev =>
      prev.map(record =>
        record.id === id
          ? { ...record, status: !record.status }
          : record
      )
    );
  };

  const saveAttendanceChanges = async () => {
    setSavingAttendance(true);
    try {
      const promises = editRecords.map(record => {
        return markAttendance({
          student_id: record.student_id,
          date: record.date,
          status: record.status,
          department_id: record.department_id || userDepartmentId,
          assigned_class: record.assigned_class,
          ...(record.event_id && { event_id: record.event_id })
        });
      });
      await Promise.all(promises);
      toast({
        title: "Asistencia actualizada",
        description: "Los cambios han sido guardados exitosamente.",
      });
      setIsEditMode(false);
      setRefreshTrigger(prev => prev + 1);
      await refetchDateAttendance();
      await refetchAttendance();
    } catch (error) {
      console.error("Error saving attendance changes:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios. Por favor, inténtelo nuevamente.",
        variant: "destructive"
      });
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleDeleteAttendanceByDate = async () => {
    setDeletingAttendance(true);
    try {
      let departmentIdToUse = null;
      if (isAdminOrSecretaria && selectedDepartment !== "all") {
        const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
        if (departmentData && departmentData.id) {
          departmentIdToUse = departmentData.id;
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      const classToFilter = (isAdminOrSecretaria || isDirector)
        ? (selectedClass !== "all" ? selectedClass : undefined)
        : (userClass || undefined);

      const deleted = await deleteAttendanceByDate({
        date: format(editDate, "yyyy-MM-dd"),
        department_id: departmentIdToUse,
        assigned_class: classToFilter,
      });

      toast({
        title: "Asistencia eliminada",
        description: `Se eliminaron ${deleted} registros de la fecha ${format(editDate, "dd/MM/yyyy")}.`,
      });
      setDeleteDialogOpen(false);
      setEditRecords([]);
      setRefreshTrigger(prev => prev + 1);
      await refetchDateAttendance();
      await refetchAttendance();
    } catch (error) {
      console.error("Error deleting attendance:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la asistencia. Intentá nuevamente.",
        variant: "destructive"
      });
    } finally {
      setDeletingAttendance(false);
    }
  };

  const attendanceStats = {
    present: attendance.filter(record => record.status).length,
    absent: attendance.filter(record => !record.status).length
  };

  const handleExportToExcel = () => {
    const data = attendance.map(record => ({
      Nombre: record.students ? `${record.students.first_name} ${record.students.last_name || ''}` : "Miembro eliminado",
      Estado: record.status ? "Presente" : "Ausente",
      Fecha: adjustDateForDisplay(record.date),
      Departamento: record.students?.departments?.name
        ? record.students.departments.name.replace(/_/g, ' ')
        : (record.department ? record.department.replace(/_/g, ' ') : 'Sin departamento'),
      Clase: record.assigned_class || 'Sin asignar'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `asistencia_${format(startDate, "dd-MM-yyyy")}_${format(endDate, "dd-MM-yyyy")}.xlsx`);
  };

  const adjustDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return format(date, "dd/MM/yyyy");
  };

  const enterEditMode = () => {
    setEditRecords([]); // Limpiar cualquier residuo de sesiones previas de edición
    setIsEditMode(true);
    setEditDate(startDate); // Empezar con la fecha que el usuario ya estaba visualizando
    setEditDateOpen(false);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setEditRecords([]);
  };

  if (attendanceLoading && !isEditMode) {
    return <LoadingOverlay message="Cargando historial..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-12">
      <TourGuide tourKey="historial_asistencia" steps={tourSteps} run={runTour} onClose={() => setRunTour(false)} />

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div data-tour="hist-header" className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 md:px-10 pt-10 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        </div>
        <div className="relative z-10 max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-purple-200 text-xs font-black uppercase tracking-[0.2em] mb-2">
              {isEditMode ? "Modo Edición" : "Registro histórico"}
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
              Historial de Asistencias
            </h1>
            <p className="text-purple-200 mt-2 text-sm font-medium">
              {isEditMode
                ? `Editando · ${editRecords.length} registros`
                : `${attendance.length.toLocaleString()} registros en el período seleccionado`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setRunTour(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm transition-all"
              title="Ver guía"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Ayuda
            </button>
            <button
              data-tour="hist-edit"
              onClick={isEditMode ? exitEditMode : enterEditMode}
              className={cn(
                "flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-black uppercase tracking-widest border backdrop-blur-sm transition-all",
                isEditMode
                  ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                  : "bg-white/15 hover:bg-white/25 text-white border-white/20"
              )}
            >
              {isEditMode ? <X className="h-3.5 w-3.5" /> : <PenSquare className="h-3.5 w-3.5" />}
              {isEditMode ? "Salir de Edición" : "Editar Historial"}
            </button>
            {isAdminOrSecretaria && !isEditMode && (
              <button
                onClick={handleExportToExcel}
                disabled={!attendance.length}
                className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm transition-all disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                Excel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 -mt-8 space-y-5 pb-28">

        {/* ── KPI Cards ─────────────────────────────────────────────────── */}
        <div data-tour="hist-kpis" className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Presentes",
              value: isEditMode ? editRecords.filter(r => r.status).length : attendanceStats.present,
              sub: "asistieron",
              icon: UserCheck,
              color: "from-emerald-500 to-teal-600",
              light: "bg-emerald-50 dark:bg-emerald-950/50",
              text: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Ausentes",
              value: isEditMode ? editRecords.filter(r => !r.status).length : attendanceStats.absent,
              sub: "no asistieron",
              icon: UserX,
              color: "from-rose-500 to-red-600",
              light: "bg-rose-50 dark:bg-rose-950/50",
              text: "text-rose-600 dark:text-rose-400",
            },
            {
              label: "Registros",
              value: isEditMode ? editRecords.length : attendance.length,
              sub: "en el período",
              icon: Users,
              color: "from-violet-500 to-purple-600",
              light: "bg-violet-50 dark:bg-violet-950/50",
              text: "text-violet-600 dark:text-violet-400",
            },
          ].map((kpi, i) => (
            <div key={i} className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.color}`} />
              <div className="p-5 md:p-6">
                <div className={`inline-flex p-3 rounded-2xl ${kpi.light} mb-3`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.text}`} />
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">
                    {kpi.value.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtros ────────────────────────────────────────────────────── */}
        <div data-tour="hist-filtros" className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900 border border-slate-100 dark:border-slate-800 px-5 py-4">
          {isEditMode ? (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 animate-fade-in">
              <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <CalendarIcon className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Fecha</span>
                <DatePickerField
                  value={editDate}
                  onChange={handleEditDateSelect}
                  open={editDateOpen}
                  onOpenChange={setEditDateOpen}
                  className="bg-transparent border-none outline-none font-bold text-sm text-slate-700 dark:text-slate-200"
                />
              </div>
              {isDirector && (
                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[150px]">
                  <Users className="h-4 w-4 text-blue-500 shrink-0" />
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-[13px] font-semibold w-full">
                      <SelectValue placeholder="Seleccionar Clase" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-medium">Seleccionar Clase</SelectItem>
                      {availableClasses.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-black uppercase tracking-widest border border-rose-200 transition-all w-full sm:w-auto sm:ml-auto"
                title="Eliminar toda la asistencia de esta fecha"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Borrar fecha
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[150px]">
                <CalendarIcon className="h-4 w-4 text-purple-500 shrink-0" />
                <Select value={selectedRange} onValueChange={handleDateRangeChange}>
                  <SelectTrigger className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-[13px] font-semibold w-full">
                    <SelectValue placeholder="Rango" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRangeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs font-medium">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[165px]">
                <span className="text-[10px] font-black text-purple-500 shrink-0 tracking-widest">DESDE</span>
                <DatePickerField
                  value={startDate}
                  onChange={handleStartDateSelect}
                  open={startDateOpen}
                  onOpenChange={setStartDateOpen}
                  className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-700 dark:text-slate-200 w-full"
                />
              </div>

              <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[165px]">
                <span className="text-[10px] font-black text-purple-500 shrink-0 tracking-widest">HASTA</span>
                <DatePickerField
                  value={endDate}
                  onChange={handleEndDateSelect}
                  open={endDateOpen}
                  onOpenChange={setEndDateOpen}
                  className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-700 dark:text-slate-200 w-full"
                />
              </div>

              {isAdminOrSecretaria && (
                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[160px]">
                  <PersonStanding className="h-4 w-4 text-indigo-500 shrink-0" />
                  <Select
                    value={selectedDepartment}
                    onValueChange={(val) => { setSelectedDepartment(val); setSelectedClass("all"); }}
                  >
                    <SelectTrigger className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-[13px] font-semibold w-full">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-medium">Todos los Deptos</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name} className="text-xs font-medium">{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(isAdminOrSecretaria || isDirector) && (
                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50 dark:bg-slate-800 rounded-2xl min-w-[150px]">
                  <Users className="h-4 w-4 text-blue-500 shrink-0" />
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                    disabled={selectedDepartment === "all"}
                  >
                    <SelectTrigger className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-[13px] font-semibold w-full">
                      <SelectValue placeholder={isDirector ? "Clase" : "Todas las Clases"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs font-medium">
                        {isDirector ? "Seleccionar Clase" : "Todas las Clases"}
                      </SelectItem>
                      {availableClasses.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs font-medium">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="animate-fade-in">
          {isEditMode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Editando Asistencia · {editRecords.length} Registros
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {isLoadingDepartmentStudents || dateAttendanceLoading ? (
                  Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="glass-card h-20 animate-pulse opacity-40" />
                  ))
                ) : !editRecords?.length ? (
                  <div className="col-span-full py-20 text-center glass-card border-dashed">
                    <UserX className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Sin resultados para la fecha seleccionada.</p>
                  </div>
                ) : (
                  editRecords
                    .sort((a, b) => {
                      const gA = (a.students?.gender || '').toLowerCase();
                      const gB = (b.students?.gender || '').toLowerCase();
                      if (gA !== gB) {
                        return gA === "femenino" ? -1 : 1;
                      }
                      return (a.students?.first_name || '').localeCompare(b.students?.first_name || '');
                    })
                    .map((record) => {
                      const student = record.students;
                      const isFemale = (student?.gender || '').toLowerCase() === 'femenino';
                      return (
                        <div key={record.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all duration-300 group">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${isFemale ? 'bg-pink-400' : 'bg-blue-400'} group-hover:scale-125 transition-transform`} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-base text-slate-800 dark:text-slate-100 truncate block leading-tight">
                              {getFullName(student)}
                            </span>
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              <Badge className="text-[9px] px-2 py-0 h-4 bg-slate-100 text-slate-500 border-none font-bold uppercase tracking-wider">
                                {record.assigned_class || 'Sin clase'}
                              </Badge>
                              {student?.is_authorized && <Badge className="text-[9px] px-2 py-0 h-4 bg-green-100 text-green-700 border-none font-bold uppercase tracking-wider">Autorizado</Badge>}
                              {student?.nuevo && <Badge className="text-[9px] px-2 py-0 h-4 bg-blue-100 text-blue-700 border-none font-bold uppercase tracking-wider">Nuevo</Badge>}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleAttendanceStatus(record.id)}
                            disabled={savingAttendance}
                            className={`w-12 h-12 rounded-2xl font-black text-lg transition-all duration-300 shrink-0 flex items-center justify-center transform active:scale-95 ${record.status ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20' : 'bg-rose-50 text-rose-500 hover:bg-rose-100'}`}
                          >
                            {record.status ? 'P' : 'A'}
                          </button>
                        </div>
                      );
                    })
                )}
              </div>

              {!isLoadingDepartmentStudents && editRecords.length > 0 && (
                <div className="flex justify-center pt-8">
                  <Button onClick={saveAttendanceChanges} disabled={savingAttendance} className="w-full max-w-md h-14 button-gradient rounded-2xl font-black text-lg shadow-xl shadow-primary/20">
                    {savingAttendance ? "Guardando cambios..." : "Guardar Cambios"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/50 shadow-lg rounded-3xl overflow-hidden">
              <div className="overflow-x-auto no-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50">
                      <TableHead className="font-black text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-widest pl-8">Miembro</TableHead>
                      <TableHead className="font-black text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-widest">Estado</TableHead>
                      <TableHead className="font-black text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-widest">Fecha</TableHead>
                      {!isMobile && (
                        <>
                          <TableHead className="font-black text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-widest">Departamento</TableHead>
                          <TableHead className="font-black text-slate-800 dark:text-slate-100 uppercase text-[11px] tracking-widest pr-8">Clase</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={5} className="py-8"><div className="h-6 w-full bg-slate-100 animate-pulse rounded-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : (attendance || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-20 text-center text-muted-foreground italic">
                          No se encontraron registros de asistencia para este período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (attendance || []).map((record) => (
                        <TableRow key={record.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                          <TableCell className="font-bold text-slate-800 dark:text-slate-100 pl-8">{getFullName(record.students)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter ${record.status ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-600"}`}>
                              {record.status ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              {record.status ? "Presente" : "Ausente"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-600 dark:text-slate-400">{adjustDateForDisplay(record.date)}</TableCell>
                          {!isMobile && (
                            <>
                              <TableCell className="capitalize text-slate-500 text-xs font-bold">
                                {record.students?.departments?.name
                                  ? record.students.departments.name.replace(/_/g, ' ')
                                  : (record.department ? record.department.replace(/_/g, ' ') : 'Sin depto')}
                              </TableCell>
                              <TableCell className="text-slate-500 text-xs font-bold pr-8">
                                {record.assigned_class || '—'}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la asistencia de esta fecha?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>todos</strong> los registros de asistencia del{" "}
              <strong>{format(editDate, "dd/MM/yyyy")}</strong>
              {(isAdminOrSecretaria || isDirector) && selectedClass !== "all" && (
                <> para la clase <strong>{selectedClass}</strong></>
              )}
              . Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAttendance}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAttendanceByDate(); }}
              disabled={deletingAttendance}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deletingAttendance ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HistorialAsistencia;
