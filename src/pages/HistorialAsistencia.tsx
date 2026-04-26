import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { getAttendance, getDepartmentByName } from "@/lib/api";
import { Download, Search, UserCheck, UserX, Calendar as CalendarIcon, PenSquare, Check, X, Save, MoreVertical, PersonStanding, CheckCircle2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";
import { DatePickerField } from "@/components/DatePickerField";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Attendance } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { markAttendance } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { LoadingOverlay } from "@/components/LoadingOverlay";

const dateRangeOptions = [
  { label: "Hoy", value: "today" },
  { label: "Últimos 7 días", value: "7days" },
  { label: "Este mes", value: "thisMonth" },
  { label: "Rango personalizado", value: "custom" }
];

const departments = [
  { value: "escuelita_central", label: "Escuelita Central" },
  { value: "pre_adolescentes", label: "Pre-adolescentes" },
  { value: "adolescentes", label: "Adolescentes" },
  { value: "jovenes", label: "Jóvenes" },
  { value: "jovenes_adultos", label: "Jóvenes Adultos" },
  { value: "adultos", label: "Adultos" }
];

const getFullName = (student: any): string => {
  if (!student) return "Miembro eliminado";

  return student.last_name
    ? `${student.first_name} ${student.last_name}`
    : student.first_name;
};

const HistorialAsistencia = () => {
  const [selectedRange, setSelectedRange] = useState("today");
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

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const isDirector = profile?.role === 'director';
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
      const classToFilter = (isAdminOrSecretaria && selectedClass !== "all") ? selectedClass : (!isAdminOrSecretaria ? (userClass || "") : undefined);
      const attendanceData = await getAttendance(formattedDate, formattedDate, "", departmentIdToUse, classToFilter);
      if (isAdminOrSecretaria && selectedClass !== "all") {
        return attendanceData.filter(record => record.assigned_class === selectedClass);
      } else if (!isAdminOrSecretaria) {
        return attendanceData.filter(record => record.assigned_class === (userClass || ""));
      }
      return attendanceData;
    },
    enabled: isEditMode && !!editDate
  });

  const { data: departmentStudents = [], isLoading: isLoadingDepartmentStudents } = useQuery({
    queryKey: ["students-for-attendance", userDepartmentId, selectedDepartment, selectedClass],
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
      let query = supabase
        .from('students')
        .select('*, departments:department_id(name)')
        .eq('department_id', departmentIdToUse)
        .is('deleted_at', null);

      if (isAdminOrSecretaria && selectedClass !== "all") {
        query = query.eq('assigned_class', selectedClass);
      } else if (!isAdminOrSecretaria) {
        query = query.eq('assigned_class', userClass || "");
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching students:", error);
        return [];
      }
      return data || [];
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
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight mb-1">
              Historial de Asistencias
            </h1>
            <p className="text-sm text-muted-foreground">
              Consultá y gestioná el registro histórico de las distintas áreas.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={isEditMode ? exitEditMode : enterEditMode}
              className={cn(
                "rounded-xl font-bold flex-1 sm:flex-none transition-all",
                isEditMode
                  ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  : "button-gradient shadow-lg shadow-primary/20 text-white"
              )}
            >
              {isEditMode ? <X className="mr-2 h-4 w-4" /> : <PenSquare className="mr-2 h-4 w-4" />}
              {isEditMode ? "Salir de Edición" : "Editar Historial"}
            </Button>
            {isAdminOrSecretaria && !isEditMode && (
              <Button
                onClick={handleExportToExcel}
                disabled={!attendance.length}
                variant="outline"
                className="border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl font-bold flex-1 sm:flex-none"
              >
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
            )}
          </div>
        </div>

        {/* Stats and Filter Row */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="glass-card flex items-center gap-6 px-6 py-4 lg:w-auto overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div className="whitespace-nowrap">
                <div className="text-xl font-black text-green-600 leading-none">
                  {isEditMode ? editRecords.filter(r => r.status).length : attendanceStats.present}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Presentes</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-100 shrink-0" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div className="whitespace-nowrap">
                <div className="text-xl font-black text-red-500 leading-none">
                  {isEditMode ? editRecords.filter(r => !r.status).length : attendanceStats.absent}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ausentes</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-100 shrink-0" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="whitespace-nowrap">
                <div className="text-xl font-black text-primary leading-none">
                  {isEditMode ? editRecords.length : attendance.length}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Registros</div>
              </div>
            </div>
          </div>

          <div className="glass-card flex-1 flex flex-col md:flex-row items-center gap-3 px-4 py-4 md:py-0">
            {isEditMode ? (
              <div className="flex flex-col md:flex-row items-center gap-3 w-full animate-fade-in">
                <div className="flex items-center gap-3 w-full md:w-auto h-full">
                  <DatePickerField
                    value={editDate}
                    onChange={handleEditDateSelect}
                    open={editDateOpen}
                    onOpenChange={setEditDateOpen}
                    className="bg-transparent border-none outline-none font-bold text-sm text-gray-700 w-full"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 w-full py-2">
                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-transparent min-w-[150px]">
                  <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                  <select
                    value={selectedRange}
                    onChange={(e) => handleDateRangeChange(e.target.value)}
                    className="bg-transparent border-none outline-none text-[13px] w-full font-semibold cursor-pointer"
                  >
                    {dateRangeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-transparent min-w-[150px]">
                  <div className="text-[10px] font-black text-primary shrink-0">DESDE</div>
                  <DatePickerField
                    value={startDate}
                    onChange={handleStartDateSelect}
                    open={startDateOpen}
                    onOpenChange={setStartDateOpen}
                    className="bg-transparent border-none outline-none text-[13px] font-semibold text-gray-700 w-full"
                  />
                </div>

                <div className="flex items-center gap-2 px-3 h-10 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-transparent min-w-[150px]">
                  <div className="text-[10px] font-black text-primary shrink-0">HASTA</div>
                  <DatePickerField
                    value={endDate}
                    onChange={handleEndDateSelect}
                    open={endDateOpen}
                    onOpenChange={setEndDateOpen}
                    className="bg-transparent border-none outline-none text-[13px] font-semibold text-gray-700 w-full"
                  />
                </div>

                {isAdminOrSecretaria && (
                  <div className="flex items-center gap-2 px-3 h-10 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-transparent">
                    <PersonStanding className="h-4 w-4 text-indigo-500 shrink-0" />
                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setSelectedClass("all");
                      }}
                      className="bg-transparent border-none outline-none text-[13px] w-full font-semibold cursor-pointer"
                    >
                      <option value="all">Todos los Deptos</option>
                      {departments.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}
                    </select>
                  </div>
                )}

                {(isAdminOrSecretaria || isDirector) && (
                  <div className="flex items-center gap-2 px-3 h-10 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-transparent">
                    <Users className="h-4 w-4 text-blue-500 shrink-0" />
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      disabled={selectedDepartment === "all"}
                      className="bg-transparent border-none outline-none text-[13px] w-full font-semibold cursor-pointer"
                    >
                      <option value="all">{isDirector ? "Seleccionar Clase" : "Todas las Clases"}</option>
                      {availableClasses.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
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
    </div>
  );
};

export default HistorialAsistencia;
