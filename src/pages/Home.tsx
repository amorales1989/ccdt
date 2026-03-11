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
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);
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
  // Solo cargar estudiantes si NO es departamento calendario
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

        // Verificar si el estudiante pertenece a los departamentos del usuario
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

        if (isBirthdayToday) {
          daysUntilBirthday = 0;
          birthdayThisYear = `${String(currentDay).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}`;
        } else {
          let birthdayDate = new Date(currentYear, birthMonth - 1, birthDay);

          if (birthdayDate < today) {
            birthdayDate = new Date(currentYear + 1, birthMonth - 1, birthDay);
          }

          const timeDiff = birthdayDate.getTime() - today.getTime();
          daysUntilBirthday = Math.ceil(timeDiff / (1000 * 3600 * 24));

          birthdayThisYear = `${String(birthDay).padStart(2, '0')}/${String(birthMonth).padStart(2, '0')}`;
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
          isBirthdayToday
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

  const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria" || profile?.role === "secr.-calendario";
  const isTeacherOrLeader = profile?.role === "maestro" || profile?.role === "lider";

  const handleDepartmentClick = (department: Department) => {
    setSelectedDepartment(department);
    setDetailsDialogOpen(true);
  };

  const handleClassClick = (departmentName: string, className: string) => {
    setDetailsDialogOpen(false);
    navigate(`/listar?department=${departmentName}&class=${className}`);
  };

  const handlePendingRequestsClick = () => {
    navigate("/solicitudes");
  };

  const renderStudentStats = () => {
    if (!profile) {
      window.location.href = '/';
      return;
    }

    const userDepartments = profile.departments || [];
    const userAssignedClass = profile.assigned_class;

    const filteredStudents = isTeacherOrLeader && userAssignedClass
      ? students.filter(s => s.assigned_class === userAssignedClass || s.isAuthorized)
      : students;

    let departmentsToShow = [];

    if (isAdminOrSecretary) {
      departmentsToShow = departments
        .map(dept => dept.name as DepartmentType)
        .filter(name => name && name !== 'calendario');
    } else {
      departmentsToShow = userDepartments.filter(dept =>
        dept !== 'calendario' && departments.some(d => d.name === dept)
      ) as DepartmentType[];
    }

    const studentsByDepartment = departmentsToShow.reduce<DepartmentStatsMap>((acc, dept) => {
      if (!isAdminOrSecretary && !userDepartments.includes(dept)) {
        return acc;
      }

      let deptStudents = filteredStudents.filter(s => {
        const studentDept = s.department && s.departments.name ? s.departments.name : s.department;
        return studentDept === dept || s.isAuthorized;
      });
      acc[dept] = {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
      return acc;
    }, {} as DepartmentStatsMap);

    const formatDepartmentName = (name: string) => {
      return name.replace(/_/g, ' ').split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    const departmentsWithStats = Object.entries(studentsByDepartment);

    const isSingleCard = departmentsWithStats.length === 1;

    const showClassLabel = isTeacherOrLeader && userAssignedClass;

    let statsTitle = "";
    if (isTeacherOrLeader && userAssignedClass) {
      statsTitle = userAssignedClass;
    } else if (departmentsWithStats.length === 1) {
      statsTitle = formatDepartmentName(departmentsWithStats[0][0]);
    } else {
      statsTitle = "Estadísticas de Alumnos";
    }

    const getClassesForDepartment = (deptName: string) => {
      const dept = departments.find(d => d.name === deptName);
      return dept?.classes || [];
    };

    const getStatsForClass = (deptName: string, className: string): ClassStats => {
      const deptStudents = filteredStudents.filter(s => {
        const studentDept = s.departments?.name || s.department;
        return studentDept === deptName && s.assigned_class === className;
      });

      return {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
    };

    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-primary">
              {statsTitle}
            </h2>
            <p className="text-muted-foreground text-sm">Resumen general y distribución por género</p>
          </div>

          {/* Botón de solicitudes pendientes */}
          {isAdminOrSecretary && pendingRequests.length > 0 && (
            <Button
              onClick={handlePendingRequestsClick}
              variant="outline"
              className="bg-orange-50/50 border-orange-200 hover:bg-orange-100 text-orange-700 hover:text-orange-800 transition-all duration-300 shadow-sm hover:shadow-md animate-bounce-slow"
            >
              <Bell className="mr-2 h-4 w-4" />
              <span className="mr-2">
                Solicitud{pendingRequests.length !== 1 ? 'es' : ''} Pendiente{pendingRequests.length !== 1 ? 's' : ''}
              </span>
              <Badge variant="secondary" className="bg-orange-200 text-orange-800 font-bold px-2 py-0.5 rounded-full">
                {pendingRequests.length}
              </Badge>
            </Button>
          )}
        </div>

        <div className={`grid gap-6 ${isSingleCard ? 'place-items-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {departmentsWithStats.map(([dept, stats], index) => {
            const departmentObj = departments.find(d => d.name === dept);
            const hasClasses = departmentObj?.classes?.length > 0;
            const malePercent = stats.total > 0 ? (stats.male / stats.total) * 100 : 0;
            const femalePercent = stats.total > 0 ? (stats.female / stats.total) * 100 : 0;

            return (
              <div
                key={dept}
                className={`glass-card group relative p-6 cursor-pointer hover:border-primary/50 transition-all duration-500 hover:-translate-y-1 animate-slide-in ${isSingleCard ? 'w-full max-w-md' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => isAdminOrSecretary && hasClasses ? handleDepartmentClick(departmentObj) : null}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <PersonStanding className="h-12 w-12 text-primary rotate-12" />
                </div>

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                      Departamento
                    </Badge>
                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                      {formatDepartmentName(dept)}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-primary">{stats.total}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Alumnos</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1 text-[#3A82AF] uppercase">
                        <PersonStanding className="h-3 w-3" /> Varones
                      </span>
                      <span>{stats.male} ({Math.round(malePercent)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-accent/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#3A82AF] to-[#60b3e5] rounded-full transition-all duration-1000"
                        style={{ width: `${malePercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1 text-[#E83E8C] uppercase">
                        <PersonStanding className="h-3 w-3" /> Mujeres
                      </span>
                      <span>{stats.female} ({Math.round(femalePercent)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-accent/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#E83E8C] to-[#f988b4] rounded-full transition-all duration-1000"
                        style={{ width: `${femalePercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {(showClassLabel || (isAdminOrSecretary && hasClasses)) && (
                  <div className="mt-8 flex items-center justify-between text-xs border-t border-accent/20 pt-4">
                    {showClassLabel ? (
                      <span className="flex items-center gap-1 font-medium bg-secondary/10 text-secondary px-2 py-1 rounded">
                        <CheckCircle2 className="h-3 w-3" /> Clase: {userAssignedClass}
                      </span>
                    ) : <span></span>}

                    {isAdminOrSecretary && hasClasses && (
                      <span className="text-primary font-bold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                        Ver detalles <Plus className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedDepartment && (
          <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
            <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl glass-card border-none p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl">
              <div className="bg-primary/10 p-8 border-b border-primary/20">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-primary mb-1">
                    {formatDepartmentName(selectedDepartment.name || '')}
                  </DialogTitle>
                  <p className="text-muted-foreground">Desglose de alumnos por clase asignada</p>
                </DialogHeader>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                {selectedDepartment.classes && selectedDepartment.classes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedDepartment.classes.map((className, idx) => {
                      const classStats = getStatsForClass(selectedDepartment.name || '', className);
                      return (
                        <div
                          key={className}
                          className="bg-accent/5 border border-accent/20 rounded-xl p-6 cursor-pointer hover:bg-white hover:shadow-xl hover:border-primary/30 transition-all duration-300 animate-fade-in"
                          style={{ animationDelay: `${idx * 0.05}s` }}
                          onClick={() => handleClassClick(selectedDepartment.name || '', className)}
                        >
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-bold text-foreground">{className}</h4>
                            <div className="bg-primary text-white px-3 py-1 rounded-full text-xs font-black">
                              {classStats.total} TOTAL
                            </div>
                          </div>

                          <div className="flex justify-around gap-8">
                            <div className="flex flex-col items-center group/gender">
                              <div className="bg-[#3A82AF]/10 p-3 rounded-2xl group-hover/gender:bg-[#3A82AF]/20 transition-colors mb-2">
                                <PersonStanding className="h-8 w-8 text-[#3A82AF]" />
                              </div>
                              <span className="text-2xl font-black text-[#3A82AF]">{classStats.male}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Varones</span>
                            </div>

                            <div className="flex flex-col items-center group/gender">
                              <div className="bg-[#E83E8C]/10 p-3 rounded-2xl group-hover/gender:bg-[#E83E8C]/20 transition-colors mb-2">
                                <PersonStanding className="h-8 w-8 text-[#E83E8C]" />
                              </div>
                              <span className="text-2xl font-black text-[#E83E8C]">{classStats.female}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mujeres</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 opacity-50">
                    <p className="text-lg font-medium">No hay clases configuradas</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  };

  const { mutate: createEventMutate } = useMutation({
    mutationFn: (newEvent: Omit<Event, "id" | "created_at" | "updated_at">) => createEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento creado",
        description: "El evento ha sido creado exitosamente",
      });
      setEventDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al crear el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: updateEventMutate } = useMutation({
    mutationFn: (event: Event) => {
      if (!event.id) {
        throw new Error("Event ID is required for update operations");
      }
      return updateEvent(event.id, event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento actualizado",
        description: "El evento ha sido actualizado exitosamente",
      });
      setEventDialogOpen(false);
      setSelectedEventForEdit(null);
    },
    onError: (error) => {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Hubo un error al actualizar el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: deleteEventMutate } = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el evento",
        variant: "destructive",
      });
    }
  });

  const handleCreateEvent = (event: Omit<Event, "id" | "created_at" | "updated_at">) => {
    createEventMutate(event);
  };

  const handleUpdateEvent = (event: any) => {
    if (!event.id && selectedEventForEdit) {
      event.id = selectedEventForEdit.id;
    }
    updateEventMutate(event as Event);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEventMutate(id);
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEventForEdit(event);
    setEventDialogOpen(true);
  };

  const futureEvents = useMemo(() => {
    const regularEvents = events
      .filter(event => !isBefore(new Date(event.date), startOfToday()))
      .filter(event => {
        const esSolicitud = (event as any).solicitud === true || (event as any).solicitud === 'true';
        return !esSolicitud;
      })
      .filter(event =>
        !searchTerm ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );

    if (isCalendarDepartment) {
      return regularEvents.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
    }

    const birthdayEvents = upcomingBirthdays
      .filter(birthday =>
        !searchTerm ||
        birthday.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        'cumpleaños'.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (birthday.department && birthday.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (birthday.assigned_class && birthday.assigned_class.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .map(birthday => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const [birthYear, birthMonth, birthDay] = birthday.birthdate.split('-').map(Number);

        let birthdayDate = new Date(currentYear, birthMonth - 1, birthDay);

        if (isBefore(birthdayDate, startOfToday())) {
          birthdayDate = new Date(currentYear + 1, birthMonth - 1, birthDay);
        }

        const formatDepartmentName = (name: string) => {
          return name?.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ') || '';
        };

        return {
          id: `birthday-${birthday.first_name}-${birthday.last_name}`,
          title: birthday.fullName,
          date: `${birthdayDate.getFullYear()}-${String(birthdayDate.getMonth() + 1).padStart(2, '0')}-${String(birthdayDate.getDate()).padStart(2, '0')}`,
          time: '',
          description: 'Cumpleaños',
          created_at: '',
          updated_at: '',
          isBirthday: true,
          daysUntilBirthday: birthday.daysUntilBirthday
        };
      });

    const allEvents = [...regularEvents, ...birthdayEvents];
    return allEvents.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [events, upcomingBirthdays, searchTerm, isCalendarDepartment]);

  const renderActionButtons = (event: EventWithBirthday) => {
    if (event.isBirthday || !isAdminOrSecretary) return null;

    if (isMobile) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            <DropdownMenuItem onClick={() => handleEditEvent(event)}>
              <Edit2 className="mr-2 h-4 w-4 text-primary" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteEvent(event.id)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleEditEvent(event)}
        >
          <Edit2 className="h-4 w-4 text-white" />
          <span className="sr-only">Editar</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleDeleteEvent(event.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Eliminar</span>
        </Button>
      </div>
    );
  };

  // Renderizar el calendario de eventos
  const renderCalendar = () => (
    <div className="animate-fade-in delay-200">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
        <div className="text-center md:text-left">
          <h2 className="text-3xl font-bold tracking-tight text-primary">
            Calendario de Eventos
          </h2>
          <p className="text-muted-foreground text-sm">Próximas actividades y celebraciones</p>
        </div>

        {isAdminOrSecretary && (
          <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="button-gradient shadow-lg hover:shadow-primary/30 transition-all duration-300"
                onClick={() => setSelectedEventForEdit(null)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md sm:max-w-md glass-card border-none shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-primary">
                  {selectedEventForEdit ? "Editar Evento" : "Agregar Evento"}
                </DialogTitle>
              </DialogHeader>
              <EventForm
                onSubmit={selectedEventForEdit ? handleUpdateEvent : handleCreateEvent}
                initialData={selectedEventForEdit || undefined}
                onSuccess={() => {
                  setEventDialogOpen(false);
                  setSelectedEventForEdit(null);
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="glass-card p-6 mb-8">
        <div className="relative group max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-primary/40 group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder="Filtrar por título, descripción o departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 py-6 bg-accent/5 border-accent/20 focus:bg-white transition-all duration-300 rounded-xl"
          />
        </div>
      </div>

      {eventsLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 glass-card animate-pulse opacity-50"></div>
          ))}
        </div>
      ) : futureEvents.length === 0 ? (
        <div className="text-center py-20 glass-card border-dashed">
          <Calendar className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-xl font-medium text-muted-foreground">No hay eventos próximos programados</p>
          {isAdminOrSecretary && (
            <p className="text-sm text-muted-foreground mt-2">Usa el botón superior para crear el primero</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {futureEvents.map((event, index) => {
            const eventDate = new Date(event.date);
            const isToday = differenceInDays(eventDate, startOfToday()) === 0;

            return (
              <div
                key={event.id}
                className="glass-card group flex flex-col md:flex-row items-center p-0 overflow-hidden hover:border-primary/40 transition-all duration-300 animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Date Side */}
                <div className={`w-full md:w-32 flex flex-row md:flex-col items-center justify-center p-4 gap-2 md:gap-0 ${isToday ? 'bg-primary text-white' : 'bg-primary/5 text-primary'} group-hover:scale-110 transition-transform duration-500 relative`}>
                  <div className="flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0">
                    <span className="text-3xl font-black">
                      {(() => {
                        const parts = event.date.split('T')[0].split('-');
                        return parts[2] || '00';
                      })()}
                    </span>
                    <span className="text-xs uppercase font-bold tracking-widest">
                      {(() => {
                        const parts = event.date.split('T')[0].split('-');
                        if (parts.length === 3) {
                          const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
                          return monthNames[parseInt(parts[1]) - 1];
                        }
                        return '---';
                      })()}
                    </span>
                  </div>
                  {/* Actions explicitly for mobile in the date bar */}
                  <div className="md:hidden absolute right-4">
                    {renderActionButtons(event)}
                  </div>
                </div>

                {/* Content Side */}
                <div className="flex-1 p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2 justify-center md:justify-start">
                      <h3 className="text-xl font-bold text-foreground pr-8 md:pr-0">
                        {event.title}
                      </h3>
                      {event.time && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-bold flex items-center gap-1.5 px-3 py-1">
                          <Clock className="h-3.5 w-3.5" />
                          {event.time}
                        </Badge>
                      )}
                      {isToday && (
                        <Badge className="bg-success/10 text-success border-success/20 animate-pulse">HOY</Badge>
                      )}
                    </div>
                    {event.isBirthday ? (
                      <Badge className="bg-pink-100 text-pink-600 border-pink-200 font-bold px-3 py-1 mt-1">
                        {event.description}
                      </Badge>
                    ) : (
                      <p className="text-muted-foreground line-clamp-2 text-sm italic">
                        {event.description || "Sin descripción adicional"}
                      </p>
                    )}
                  </div>

                  {/* Actions for desktop on the right */}
                  <div className="hidden md:block">
                    {renderActionButtons(event)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

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
          {renderCalendar()}
        </section>
      </div>
    );
  }

  // Renderizar la página completa para otros departamentos
  return (
    <div className="space-y-10 pb-10">
      {isAdminOrSecretary && !studentsLoading && (
        <section className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-slate-200 dark:bg-slate-800 blur-3xl pointer-events-none"></div>
          <StudentSearch students={students} />
        </section>
      )}

      <section className="relative overflow-hidden bg-gradient-to-br from-blue-100 via-white to-indigo-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-blue-200 dark:border-slate-700 shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-400/20 blur-3xl pointer-events-none"></div>
        {renderStudentStats()}
      </section>

      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        {renderCalendar()}
      </section>
    </div>
  );
};

export default Home;