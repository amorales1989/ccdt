import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserCheck, UserX, Calendar, CalendarOff, Users, CheckCircle2, Save, HelpCircle, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { type Step } from "react-joyride";
import { TourGuide } from "@/components/TourGuide";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { markAttendance, getAttendance, getStudents, getCompany, getClassEvents, createClassEvent, deleteClassEvent, type ClassEvent } from "@/lib/api";
import { getEventColor } from "@/lib/eventColors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { DEFAULT_PERMISSIONS, hasPermission, type SavedPermissions } from "@/lib/rolePermissions";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DatePickerField } from "@/components/DatePickerField";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { ClassSelect } from "@/components/ClassSelect";
import { useDepartments } from "@/hooks/useDepartments";

const TomarAsistencia = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [asistencias, setAsistencias] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isLoading, setIsLoading] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [authorizedStudents, setAuthorizedStudents] = useState<Record<string, boolean>>({});
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [deptClasses, setDeptClasses] = useState<string[]>([]);
  const [dateOpen, setDateOpen] = useState(false);
  const [runTour, setRunTour] = useState<boolean | undefined>(undefined);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);

  // Evento especial: día en que no hubo clase por otra actividad (no genera asistencias).
  const [specialEvent, setSpecialEvent] = useState<ClassEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  const tourSteps: Step[] = [
    {
      target: '[data-tour="header"]',
      content: "Bienvenido. Aquí podés registrar la asistencia de los miembros del día.",
      disableBeacon: true,
      placement: "bottom",
    },
    {
      target: '[data-tour="stats"]',
      content: "Vas viendo en vivo cuántos están presentes, ausentes y el total.",
    },
    {
      target: '[data-tour="date"]',
      content: "Seleccioná la fecha de la asistencia. Por defecto es hoy.",
    },
    {
      target: '[data-tour="list"]',
      content: "Tocá el botón rojo 'A' (Ausente) para cambiarlo a verde 'P' (Presente). Los que no marques quedan como ausentes.",
      placement: "top",
    },
    {
      target: '[data-tour="save"]',
      content: "Cuando termines, presioná aquí para guardar la asistencia del día.",
      placement: "top",
    },
  ];


  const isDirector = profile?.role === "director" || profile?.role === "director_general" || profile?.role === "vicedirector";
  const isDirectorGeneral = profile?.role === "director_general";
  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  const { data: company } = useQuery({
    queryKey: ["company", getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });
  const role = profile?.role || '';
  const savedPerms = (company as any)?.role_permissions?.[role];
  // Misma clave que oculta "Tomar Asistencia" del menú (Configuración › Permisos):
  // si está oculta, tampoco debe poder accederse por URL directa.
  const canTakeAttendance = (savedPerms && 'menu_asistencia' in savedPerms
    ? savedPerms.menu_asistencia !== false
    : DEFAULT_PERMISSIONS[role]?.menu_asistencia !== false)
    // Roles propios de la empresa: viven en profiles.roles, no en profile.role.
    || hasPermission(profile, 'menu_asistencia', (company as { role_permissions?: SavedPermissions } | undefined)?.role_permissions);
  const [selectedDepartmentName, setSelectedDepartmentName] = useState<string | null>(null);
  const userClass = profile?.assigned_class;

  useEffect(() => {
    if (profile?.departments && profile.departments.length > 0 && !selectedDepartmentName) {
      setSelectedDepartmentName(profile.departments[0]);
    }
  }, [profile, selectedDepartmentName]);

  const { getByName } = useDepartments({ scoped: true });
  const selectedDepartmentData = getByName(selectedDepartmentName);

  useEffect(() => {
    if (selectedDepartmentData) {
      setDepartmentId(selectedDepartmentData.id);
      setDeptClasses(selectedDepartmentData.classes || []);
    }
  }, [selectedDepartmentData]);

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
    queryKey: ["students-attendance", departmentId, userClass, selectedClass, selectedDepartmentName],
    queryFn: async () => {
      if (!departmentId) return [];

      // For director, if no class selected, return empty
      if (isDirector && !selectedClass) return [];

      const classToFilter = isDirector ? selectedClass : userClass;

      const params: Record<string, string> = { department_id: departmentId };
      if (classToFilter && classToFilter !== "all") params.assigned_class = classToFilter;

      const allStudents = await getStudents(params) || [];

      // Si la clase es Obreros, traer profile.assigned_class + teacher_assignments para mostrar la clase real
      const isObrerosView = (classToFilter || '').toLowerCase() === 'obreros';
      let profileClassMap = new Map<string, string>();
      let teacherAssignmentsMap = new Map<string, any[]>();
      if (isObrerosView) {
        const profileIds = (allStudents as any[]).map(s => s.profile_id).filter(Boolean);
        if (profileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, assigned_class')
            .in('id', profileIds);
          profilesData?.forEach((p: any) => {
            if (p.assigned_class) profileClassMap.set(p.id, p.assigned_class);
          });
          try {
            const { data: asgData } = await supabase.functions.invoke('manage-users', {
              body: { action: 'get-assignments', userData: { profileIds } }
            });
            const map = asgData?.assignments || {};
            for (const pid of Object.keys(map)) teacherAssignmentsMap.set(pid, map[pid] || []);
          } catch (e) {
            console.warn('No se pudieron obtener teacher_assignments:', e);
          }
        }
      }

      const deptTokens = (selectedDepartmentName || '').toLowerCase().split(/\s+/).filter(Boolean);
      const isInvalidClass = (v?: string | null) => {
        const val = (v || '').toLowerCase().trim();
        if (!val) return true;
        if (val === 'obreros') return true;
        if (selectedDepartmentName && val === selectedDepartmentName.toLowerCase()) return true;
        if (deptTokens.includes(val)) return true;
        return false;
      };
      const effectiveClassFor = (s: any): string => {
        // 1. teacher_assignments del depto en contexto
        if (selectedDepartmentName && s.profile_id) {
          const ta = teacherAssignmentsMap.get(s.profile_id) || [];
          const inDept = ta.filter((a: any) => a.department === selectedDepartmentName && a.assigned_class);
          const valid = inDept.find((a: any) => !isInvalidClass(a.assigned_class));
          if (valid?.assigned_class) return valid.assigned_class;
        }
        // 2. profile.assigned_class
        const pc = s.profile_id ? profileClassMap.get(s.profile_id) : null;
        if (pc && !isInvalidClass(pc)) return pc;
        // 3. dept_assignments (student_departments)
        if (selectedDepartmentName && s.dept_assignments?.length) {
          const inDept = s.dept_assignments.filter((a: any) => a.departments?.name === selectedDepartmentName && a.assigned_class);
          const valid = inDept.find((a: any) => !isInvalidClass(a.assigned_class));
          if (valid?.assigned_class) return valid.assigned_class;
        }
        if (s.assigned_class && !isInvalidClass(s.assigned_class)) return s.assigned_class;
        return pc || s.assigned_class || '';
      };

      // Excluir maestros/colaboradores/auxiliares cuando la clase no es Obreros
      const onlyAlumnos = !isObrerosView
        ? (allStudents as any[]).filter(s => {
            const assigns = s.dept_assignments || [];
            const match = assigns.find((a: any) =>
              a.department_id === departmentId &&
              (a.assigned_class || '').toLowerCase() === (classToFilter || '').toLowerCase()
            );
            if (!match) return true;
            const role = (match.role_in_dept || 'alumno').toLowerCase();
            return role === 'alumno';
          })
        : (allStudents as any[]);

      const enriched = onlyAlumnos.map(s => ({
        ...s,
        _effectiveClass: isObrerosView ? effectiveClassFor(s) : null,
      }));

      return enriched.sort((a: any, b: any) => {
        if (isObrerosView) {
          const cA = (a._effectiveClass || 'zzz').toLowerCase();
          const cB = (b._effectiveClass || 'zzz').toLowerCase();
          if (cA !== cB) return cA.localeCompare(cB);
        }
        const gA = (a.gender || '').toLowerCase();
        const gB = (b.gender || '').toLowerCase();
        if (gA !== gB) {
          if (gA === "femenino") return -1;
          if (gB === "femenino") return 1;
        }
        return (a.first_name || '').localeCompare(b.first_name || '');
      });
    },
    enabled: Boolean(profile) && (Boolean(departmentId)),
  });

  // Si la fecha seleccionada ya tiene asistencia tomada, cargarla en la lista (presentes en "P")
  useEffect(() => {
    let cancelled = false;
    const loadExisting = async () => {
      const classToFilter = isDirector ? selectedClass : userClass;
      if (!departmentId || !selectedDate || (students as any[]).length === 0 || (isDirector && !selectedClass)) {
        setHasExistingRecord(false);
        return;
      }
      try {
        const data = await getAttendance(selectedDate, selectedDate, undefined, departmentId, classToFilter || undefined);
        if (cancelled) return;
        if (data && data.length > 0) {
          const map: Record<string, boolean> = {};
          data.forEach((a: any) => { map[a.student_id] = !!a.status; });
          setAsistencias(map);
          setHasExistingRecord(true);
        } else {
          setAsistencias({});
          setHasExistingRecord(false);
        }
      } catch {
        // si falla la consulta, no bloquear la toma de asistencia
      }
    };
    loadExisting();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, departmentId, selectedClass, userClass, students]);

  // ¿Esta fecha ya está marcada como día especial (sin clase)?
  useEffect(() => {
    let cancelled = false;
    const loadEvent = async () => {
      if (!departmentId || !selectedDate) {
        setSpecialEvent(null);
        return;
      }
      try {
        const eventos = await getClassEvents({
          start: selectedDate,
          end: selectedDate,
          departmentId,
          assignedClass: (isDirector ? selectedClass : userClass) || undefined,
        });
        if (!cancelled) setSpecialEvent(eventos[0] || null);
      } catch {
        // si falla, no bloquear la toma de asistencia
      }
    };
    loadEvent();
    return () => { cancelled = true; };
  }, [departmentId, selectedDate, selectedClass, userClass, isDirector]);

  const handleCreateEvent = async () => {
    const titulo = eventTitle.trim();
    if (!titulo || !departmentId) {
      toast({ title: "Falta el título", description: "Escribí qué actividad hubo ese día.", variant: "destructive" });
      return;
    }
    setSavingEvent(true);
    try {
      const evento = await createClassEvent({
        date: selectedDate,
        department_id: departmentId,
        assigned_class: (isDirector ? selectedClass : userClass) || null,
        title: titulo,
        description: eventDescription.trim() || null,
      });
      setSpecialEvent(evento);
      setEventDialogOpen(false);
      setEventTitle("");
      setEventDescription("");
      toast({ title: "Día marcado", description: "Va a aparecer pintado en el reporte de asistencia.", variant: "success" });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "No se pudo marcar el día", variant: "destructive" });
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!specialEvent) return;
    setSavingEvent(true);
    try {
      await deleteClassEvent(specialEvent.id);
      setSpecialEvent(null);
      toast({ title: "Evento quitado", description: "La fecha vuelve a quedar como un día común." });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "No se pudo quitar el evento", variant: "destructive" });
    } finally {
      setSavingEvent(false);
    }
  };

  const regularStudents = (students as any[])?.filter(s => !s.nuevo) || [];
  const newStudents = (students as any[])?.filter(s => s.nuevo === true) || [];
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

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast({ title: "Error", description: "Por favor seleccione una fecha", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const classToFilter = isDirector ? selectedClass : userClass;

      // Use the selectedDate directly as it's already in YYYY-MM-DD format
      const adjustedDate = selectedDate;
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
            assigned_class: classToFilter || student?.assigned_class || "",
          });
        })
      );

      toast({
        title: hasExistingRecord ? "Cambios guardados" : "Asistencia guardada",
        description: "Registrada exitosamente",
        variant: "success",
      });
      setHasExistingRecord(true);
    } catch {
      toast({ title: "Error", description: "Hubo un error al guardar la asistencia", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!canTakeAttendance) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <UserX className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-bold text-foreground mb-2">Acceso restringido</h3>
          <p className="text-sm text-muted-foreground">No tenés permisos para tomar asistencia. Contactá al administrador.</p>
        </div>
      </div>
    );
  }

  if (!isAdminOrSecretaria && (!profile?.departments || profile.departments.length === 0)) {
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
    return <LoadingOverlay message="Cargando miembros..." />;
  }

  // Create a local date object from the "YYYY-MM-DD" string to avoid timezone shifts
  const [year, month, day] = selectedDate.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const displayDate = format(dateObj, "EEEE, dd 'de' MMMM yyyy", { locale: es });

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
        {/* Photo */}
        <Avatar className="h-10 w-10 border border-slate-200 shadow-sm shrink-0">
          <AvatarImage
            src={student.photo_url || (isFemale ? '/avatarM.svg' : '/avatarH.svg')}
            alt={student.first_name}
            className="object-cover"
          />
          <AvatarFallback className={`text-xs font-bold ${isFemale ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
            {(student.first_name || '').charAt(0)}{(student.last_name || '').charAt(0)}
          </AvatarFallback>
        </Avatar>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-800 truncate block">
            {getFullName(student)}
          </span>
          <div className="flex gap-1.5 mt-0.5 flex-wrap">
            {student._effectiveClass && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-purple-100 text-purple-700 border-none font-bold">
                {student._effectiveClass}
              </Badge>
            )}
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
      <TourGuide
        tourKey="tomar_asistencia"
        steps={tourSteps}
        run={runTour}
        onClose={() => setRunTour(false)}
      />
      <div className="p-4 md:p-6 pb-28">

        {/* Page Header */}
        <div className="mb-6 animate-fade-in flex items-start justify-between gap-3" data-tour="header">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight mb-1">
              Tomar Asistencia
            </h1>
            <p className="text-sm text-muted-foreground capitalize">{displayDate}</p>
            {hasExistingRecord && (
              <Badge className="mt-1 bg-orange-100 text-orange-700 border-none font-bold text-[11px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Asistencia ya registrada — editando
              </Badge>
            )}
          </div>
        </div>

        {/* Día marcado como evento especial */}
        {specialEvent && (
          <div
            className="mb-6 rounded-2xl border px-5 py-4 flex items-start gap-3 animate-fade-in"
            style={{
              borderColor: getEventColor(specialEvent.color).hex,
              backgroundColor: `rgb(${getEventColor(specialEvent.color).rgb.join(',')})`,
            }}
          >
            <CalendarOff className="h-5 w-5 shrink-0 mt-0.5" style={{ color: getEventColor(specialEvent.color).hex }} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Este día no hubo clase</p>
              <p className="font-bold text-gray-800 leading-tight">{specialEvent.title}</p>
              {specialEvent.description && (
                <p className="text-sm text-gray-600 mt-0.5">{specialEvent.description}</p>
              )}
            </div>
            <button
              onClick={handleDeleteEvent}
              disabled={savingEvent}
              className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/70 hover:bg-white text-[11px] font-black uppercase tracking-widest text-gray-600 transition-all disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Quitar
            </button>
          </div>
        )}

        {/* Stats + Date row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Stats pill */}
          <div className="glass-card flex items-center gap-4 px-5 py-3 flex-1" data-tour="stats">
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
          <div className="glass-card flex items-center gap-3 px-4 py-3 sm:w-auto overflow-hidden" data-tour="date">
            <DatePickerField
              value={selectedDate ? new Date(selectedDate + "T00:00:00") : undefined}
              onChange={(date) => setSelectedDate(date ? format(date, "yyyy-MM-dd") : "")}
              open={dateOpen}
              onOpenChange={setDateOpen}
              className="bg-transparent border-none outline-none text-sm font-semibold text-gray-700 w-full"
            />
          </div>

          {/* Department Filter for Director General */}
          {isDirectorGeneral && profile?.departments && profile.departments.length > 1 && (
            <div className="glass-card flex items-center gap-3 px-4 py-3 sm:w-auto">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <DepartmentSelect
                value={selectedDepartmentName}
                onChange={(val) => {
                  setSelectedDepartmentName(val);
                  setSelectedClass("");
                  setAsistencias({});
                }}
                scoped
                placeholder="Seleccionar Depto"
                className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-sm font-semibold text-gray-700 w-full"
                itemClassName="text-xs font-medium"
              />
            </div>
          )}

          {/* Class Filter for Director/Admin */}
          {isDirector && (
            <div className="glass-card flex items-center gap-3 px-4 py-3 sm:w-auto">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-indigo-600" />
              </div>
              <ClassSelect
                classes={deptClasses}
                value={selectedClass}
                onChange={(val) => {
                  setSelectedClass(val);
                  setAsistencias({});
                }}
                placeholder="Seleccionar Clase"
                className="bg-transparent border-none shadow-none focus:ring-0 h-8 px-0 text-sm font-semibold text-gray-700 w-full"
                itemClassName="text-xs font-medium"
              />
            </div>
          )}
        </div>

        {/* Student List */}
        {students.length === 0 ? (
          <div className="glass-card p-12 text-center animate-fade-in">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No hay miembros en este departamento</p>
          </div>
        ) : (
          <div className="space-y-2" data-tour="list">
            {/* Section label */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                Miembros · {regularStudents.length}
              </div>
            </div>

            {regularStudents.map(renderStudentCard)}

            {/* New students separator */}
            {hasNewStudents && (
              <>
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                    Nuevos Miembros · {newStudents.length}
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/90 to-transparent flex justify-center gap-2" data-tour="save">
        {!specialEvent && (
          <Button
            variant="outline"
            onClick={() => setEventDialogOpen(true)}
            disabled={!selectedDate || !departmentId || (isDirector && !selectedClass)}
            className="h-12 px-4 rounded-2xl font-bold text-sm bg-white shadow-lg border-slate-200 text-slate-600"
          >
            <CalendarOff className="h-4 w-4 mr-2" />
            No hubo clase
          </Button>
        )}
        <Button
          onClick={handleSaveAttendance}
          disabled={isLoading || !selectedDate || students.length === 0}
          className="flex-1 max-w-md h-12 button-gradient shadow-xl shadow-primary/20 font-bold text-base rounded-2xl"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              {hasExistingRecord ? "Guardar cambios" : "Guardar Asistencia"}
            </div>
          )}
        </Button>
      </div>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar día sin clase</DialogTitle>
            <DialogDescription className="capitalize">
              {displayDate}
              {(isDirector ? selectedClass : userClass) ? ` · ${isDirector ? selectedClass : userClass}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">¿Qué hubo ese día?</label>
              <Input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                maxLength={80}
                placeholder="Ej: Campamento de verano"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Detalle (opcional)</label>
              <Textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                rows={3}
                placeholder="Alguna aclaración para quien lea el reporte"
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              No se registra asistencia: esta fecha va a aparecer pintada en el reporte de grilla, con este título en la leyenda.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDialogOpen(false)} disabled={savingEvent}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} disabled={savingEvent || !eventTitle.trim()}>
              {savingEvent ? "Guardando..." : "Marcar día"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TomarAsistencia;