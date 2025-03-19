import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Users, CheckCircle2, PersonStanding, Clock, MoreVertical, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getEvents, createEvent, updateEvent, deleteEvent, getStudents } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import type { Event, DepartmentType, Student } from "@/types/database";
import { StudentSearch } from "@/components/StudentSearch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu";

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => getStudents().then(data => {
      return data.map(student => ({
        ...student,
        department: student.department as DepartmentType
      })) as Student[];
    })
  });

  const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria";

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);

  const renderStudentStats = () => {
    if (!profile) return null;

    const userDepartments = profile.departments || [];

    const departmentTypes: DepartmentType[] = ["escuelita_central", "pre_adolescentes", "adolescentes", "jovenes", "jovenes_adultos", "adultos"];
    const studentsByDepartment = departmentTypes.reduce((acc, dept) => {
      if (!isAdminOrSecretary && !userDepartments.includes(dept)) {
        return acc;
      }

      const deptStudents = students.filter(s => {
        if (s.departments && s.departments.name) {
          return s.departments.name === dept;
        }
        return s.department === dept;
      });

      acc[dept] = {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
      return acc;
    }, {} as Record<DepartmentType, { male: number; female: number; total: number }>);

    const formatDepartmentName = (name: string) => {
      return name.replace(/_/g, ' ').split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    return (
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">Estadísticas de Alumnos</h2>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {Object.entries(studentsByDepartment).map(([dept, stats]) => (
            <div key={dept} className="bg-white rounded-xl overflow-hidden shadow">
              <div className="bg-[#9b87f5] p-3 text-center">
                <h3 className="font-semibold text-white text-sm sm:text-base">
                  {formatDepartmentName(dept)}
                </h3>
              </div>
              <div className="p-4 flex flex-col items-center">
                <div className="text-center mb-2">
                  <p className="text-gray-500 text-xs">Total</p>
                  <p className="text-[#7E69AB] text-4xl font-semibold">{stats.total}</p>
                </div>
                <div className="w-full space-y-1 mt-2">
                  <div className="flex items-center text-gray-600 text-sm">
                    <PersonStanding className="h-4 w-4 text-[#3A82AF] mr-1" />
                    <p>Varones: {stats.male}</p>
                  </div>
                  <div className="flex items-center text-gray-600 text-sm">
                    <PersonStanding className="h-4 w-4 text-[#E83E8C] mr-1" />
                    <p>Mujeres: {stats.female}</p>
                  </div>
                  {profile?.role === "maestro" && profile?.assigned_class && (
                    <div className="flex items-center text-gray-600 text-sm">
                      <CheckCircle2 className="h-3 w-3 text-[#7E69AB] mr-1" />
                      <p>Clase: {profile.assigned_class}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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

  const futureEvents = events.filter(event => !isBefore(new Date(event.date), startOfToday()));

  const renderActionButtons = (event: Event) => {
    if (!isAdminOrSecretary) return null;
    
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
              <Edit2 className="mr-2 h-4 w-4 text-white" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteEvent(event.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
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

  return (
    <div>
      {isAdminOrSecretary && !studentsLoading && (
        <StudentSearch students={students} />
      )}
      
      {renderStudentStats()}

      <Card>
        <CardHeader className="flex-row justify-between items-center pb-2">
          <CardTitle>Calendario de Eventos</CardTitle>
          {isAdminOrSecretary && (
            <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedEventForEdit(null)}>
                  {isMobile ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Agregar Evento
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
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
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <p>Cargando eventos...</p>
          ) : futureEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No hay eventos próximos programados</p>
              {isAdminOrSecretary && (
                <p className="text-sm text-muted-foreground mt-2">Haga clic en "Agregar Evento" para crear uno nuevo</p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Título</TableHead>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Hora</TableHead>
                    <TableHead className="font-semibold">Descripción</TableHead>
                    {isAdminOrSecretary && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futureEvents.map((event) => (
                    <TableRow key={event.id} className="hover:bg-accent/20">
                      <TableCell className="font-medium">{event.title}</TableCell>
                      <TableCell>
                        {format(new Date(event.date), "dd/MM", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {event.time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{event.time}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="max-h-16 overflow-y-auto">
                          {event.description || <span className="text-muted-foreground text-sm italic">Sin descripción</span>}
                        </div>
                      </TableCell>
                      {isAdminOrSecretary && (
                        <TableCell className="text-right">
                          {renderActionButtons(event)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
