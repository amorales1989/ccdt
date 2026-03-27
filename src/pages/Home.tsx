import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, PersonStanding, MoreVertical, MapPin, Search, CheckCircle2, Bell, Calendar, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { getEvents, createEvent, updateEvent, deleteEvent, getStudents, getDepartments } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { addYears, differenceInDays, format, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import type { Event, DepartmentType, Student, Department, EventWithBirthday } from "@/types/database";
import { CalendarWidget } from "@/components/CalendarWidget";
import { StudentStatsWidget } from "@/components/StudentStatsWidget";
import { MiniStatsCarousel } from "@/components/MiniStatsCarousel";
import { StudentSearch } from "@/components/StudentSearch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ClassStats {
  male: number;
  female: number;
  total: number;
}

type DepartmentStatsMap = Record<DepartmentType, ClassStats>;

const Home = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile, user, loading } = useAuth();

  // Redirigir si no hay sesión activa y terminó de cargar
  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const location = useLocation();
  // Detectar si el departamento es calendario
  const selectedDepartmentStorage = localStorage.getItem('selectedDepartment');
  const isCalendarDepartment = selectedDepartmentStorage === 'calendario' || profile?.departments?.[0] === 'calendario';

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    // Esperar a que el profile esté cargado
    if (!profile) return;

    const hasRedirectedThisSession = sessionStorage.getItem('calendarAutoRedirected');

    if (isCalendarDepartment &&
      !hasRedirectedThisSession) {
      sessionStorage.setItem('calendarAutoRedirected', 'true');
      navigate("/calendario", { replace: true });
    }
  }, [isCalendarDepartment, navigate, location.pathname, profile]);
  // Solo cargar miembros si NO es departamento calendario
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students', 'stats', profile?.id], // Usar prefix 'students' para que se invalide correctamente
    queryFn: async () => {
      if (!profile) return [];

      const params: any = {};
      if (profile.role !== 'admin' && profile.role !== 'secretaria') {
        params.department_id = profile.department_id;
        params.assigned_class = profile.assigned_class;
      }

      return getStudents(params);
    },
    enabled: !isCalendarDepartment && !!profile?.id,
    staleTime: 1000 * 60 * 1, // 1 minuto
  });

  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    enabled: !isCalendarDepartment && !!profile?.id, // Solo ejecutar si NO es departamento calendario y hay perfil cargado
    staleTime: 1000 * 60 * 15, // 15 minutos (datos estáticos)
  });

  const studentsBasicInfo = useMemo(() => {
    if (isCalendarDepartment) return []; // Retornar array vacío si es calendario
    return students.map(student => ({
      first_name: student.first_name,
      last_name: student.last_name,
      birthdate: student.birthdate,
      department: student.departments?.name || student.department,
      assigned_class: student.assigned_class
    }));
  }, [students, isCalendarDepartment]);

  // Calcular solicitudes pendientes
  const pendingRequests = useMemo(() => {
    return events.filter(event => {
      const esSolicitud = (event as any).solicitud === true || (event as any).solicitud === 'true';
      const estado = (event as any).estado;
      const esPendiente = !estado || estado === 'solicitud';
      return esSolicitud && esPendiente;
    });
  }, [events]);

  const upcomingBirthdays = useMemo(() => {
    if (isCalendarDepartment) return []; // No mostrar cumpleaños si es calendario

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    // Obtener departamentos y clase del usuario
    const userDepartments = profile?.departments || [];
    const userAssignedClass = profile?.assigned_class;
    const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria";
    const isTeacherOrLeader = profile?.role === "maestro" || profile?.role === "lider";

    const studentsWithDaysUntilBirthday = studentsBasicInfo
      .filter(student => student.birthdate)
      // Filtrar por departamento y clase según el perfil del usuario
      .filter(student => {
        if (isAdminOrSecretary) {
          return false; // Los admin y secretarias no ven los cumpleaños
        }

        // Para maestros y líderes, filtrar por departamento y clase
        const studentDept = student.department;
        const studentClass = student.assigned_class;

        // Verificar si el miembro pertenece a los departamentos del usuario
        const belongsToUserDepartment = userDepartments.includes(studentDept);

        // Si el usuario tiene una clase asignada, también verificar la clase
        if (isTeacherOrLeader && userAssignedClass) {
          return belongsToUserDepartment && studentClass === userAssignedClass;
        }

        return belongsToUserDepartment;
      })
      .map(student => {
        const cleanFirstName = student.first_name?.trim() || '';
        const cleanLastName = student.last_name?.trim() || '';

        const [birthYear, birthMonth, birthDay] = student.birthdate.split('-').map(Number);
        const isBirthdayToday = birthMonth === currentMonth && birthDay === currentDay;

        let daysUntilBirthday;
        let birthdayThisYear;
        let calculatedDate: string;

        if (isBirthdayToday) {
          const bDay = new Date(currentYear, birthMonth - 1, birthDay);
          birthdayThisYear = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`;
          daysUntilBirthday = 0;
          calculatedDate = bDay.toISOString();
        } else {
          let birthdayDate = new Date(currentYear, birthMonth - 1, birthDay);

          if (birthdayDate < today) {
            birthdayDate = new Date(currentYear + 1, birthMonth - 1, birthDay);
          }

          const timeDiff = birthdayDate.getTime() - today.getTime();
          daysUntilBirthday = Math.ceil(timeDiff / (1000 * 3600 * 24));

          birthdayThisYear = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`;
          calculatedDate = birthdayDate.toISOString();
        }

        return {
          first_name: cleanFirstName,
          last_name: cleanLastName,
          birthdate: student.birthdate,
          department: student.department,
          assigned_class: student.assigned_class,
          daysUntilBirthday,
          birthdayThisYear,
          fullName: `${cleanFirstName} ${cleanLastName}`,
          isBirthdayToday,
          calculatedDate
        };
      })
      .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

    const birthdaysToday = studentsWithDaysUntilBirthday.filter(student => student.daysUntilBirthday === 0);
    const upcomingOnly = studentsWithDaysUntilBirthday.filter(student => student.daysUntilBirthday > 0);

    const result = [
      ...birthdaysToday,
      ...upcomingOnly.slice(0, 4)
    ];
    return result;
  }, [studentsBasicInfo, profile, isCalendarDepartment]);

  const futureEvents = useMemo(() => {
    if (!events) return [];

    const regularEvents = events.filter(event => {
      const esSolicitud = (event as any).solicitud === true || (event as any).solicitud === 'true';
      const estado = (event as any).estado;
      const isAproved = !esSolicitud || estado === 'aprobada';
      const eventDate = new Date(event.date);
      const isPast = isBefore(eventDate, startOfToday());
      return isAproved && !isPast;
    }).map(event => ({
      ...event,
      isBirthday: false
    }));

    const birthdayEvents = upcomingBirthdays.map(birthday => ({
      id: `birthday-${birthday.first_name}-${birthday.last_name}`,
      title: `Cumpleaños: ${birthday.fullName}`,
      date: birthday.calculatedDate, // CRITICAL: Use calculatedDate for sorting
      description: 'Cumpleaños',
      isBirthday: true
    }) as EventWithBirthday);

    return [...regularEvents, ...birthdayEvents].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, upcomingBirthdays]);

  const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria" || profile?.role === "secr.-calendario";
  const isTeacherOrLeader = profile?.role === "maestro" || profile?.role === "lider";

  const handleClassClick = (departmentName: string, className: string) => {
    navigate(`/listar?department=${departmentName}&class=${className}`);
  };

  const handlePendingRequestsClick = () => {
    navigate("/solicitudes");
  };

  // Si es departamento calendario, solo mostrar el calendario y el botón de solicitudes si hay
  if (isCalendarDepartment) {
    return (
      <div className="space-y-8 pb-8">
        {/* Botón de solicitudes pendientes para calendario */}
        {isAdminOrSecretary && (
          <div className="mb-6 flex justify-end">
            <Button
              onClick={handlePendingRequestsClick}
              variant="outline"
              className={`transition-all duration-200 ${pendingRequests.length > 0
                ? "bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-700 hover:text-orange-800"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-700"
                }`}
            >
              <Bell className="mr-2 h-4 w-4" />
              <span className="mr-2">
                {pendingRequests.length > 0
                  ? `Solicitud${pendingRequests.length !== 1 ? 'es' : ''} Pendiente${pendingRequests.length !== 1 ? 's' : ''}`
                  : "Gestionar Solicitudes"
                }
              </span>
              {pendingRequests.length > 0 && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {pendingRequests.length}
                </Badge>
              )}
            </Button>
          </div>
        )}

        <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-lg">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
          <CalendarWidget
            auth={{ isAdminOrSecretary }}
            data={{ events: futureEvents, eventsLoading, searchTerm, setSearchTerm }}
          />
        </section>
      </div>
    );
  }

  // Renderizar la página completa para otros departamentos
  return (
    <div className="space-y-8 bg-[#f8fafc] dark:bg-slate-900/50 min-h-screen -mt-4 -mx-4 px-4 pt-4 sm:-mt-8 sm:-mx-8 sm:px-8 sm:pt-8 rounded-tl-3xl">
      {/* Top Navbar Section */}
      <header className="flex flex-col items-center justify-center gap-6 mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="w-full max-w-2xl mx-auto">
          {isAdminOrSecretary && !studentsLoading && (
            <StudentSearch students={students} />
          )}
        </div>
      </header>

      {/* Cards Section */}
      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 mb-8">
        <StudentStatsWidget
          auth={{ profile, isAdminOrSecretary, isTeacherOrLeader }}
          data={{ students, departments, pendingRequests }}
          actions={{ onPendingRequestsClick: handlePendingRequestsClick, onClassClick: handleClassClick }}
        />
      </section>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        {/* Left Column: Events */}
        <section className={`transition-all duration-500 ${isAdminOrSecretary ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <CalendarWidget
            auth={{ isAdminOrSecretary }}
            data={{ events: futureEvents, eventsLoading, searchTerm, setSearchTerm }}
          />
        </section>

        {/* Right Column: Actions & Resources */}
        {isAdminOrSecretary && (
          <section className="space-y-6 lg:col-span-1 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-4 px-2">
              Estadisticas generales
            </h2>

            <MiniStatsCarousel students={students} currentProfile={profile} />
          </section>
        )}
      </div>
    </div>
  );
};

export default Home;