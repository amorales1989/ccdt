import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { getEvents, deleteEvent, getStudents } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import { format, isBefore, startOfDay, isSameMonth, isAfter, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Trash2 } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import { useToast } from "@/components/ui/use-toast";
import { createEvent, updateEvent } from "@/lib/api";
import type { Event } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

export default function Calendario() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<Event[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Traer los estudiantes
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => getStudents().then(data => {
      return data.map(student => ({
        ...student,
        department: student.departments?.name || student.department
      }));
    })
  });

  // CALCULAR PRÓXIMOS 2 CUMPLEAÑOS
  function getUpcomingBirthdays() {
    if (!students || students.length === 0) return [];

    // Determinar si hay que filtrar por departamento/clase
    let filtered = students;
    if (profile && ["maestro", "lider"].includes(profile.role)) {
      // Solo cumpleaños del mismo departamento y clase (si existen asignados)
      filtered = filtered.filter(student => {
        let match = true;
        if (profile.departments && profile.departments.length > 0) {
          // student.department puede tener distintas formas
          match = match && profile.departments.includes(student.department);
        }
        if (profile.assigned_class) {
          match = match && (student.assigned_class === profile.assigned_class);
        }
        return match;
      });
    }

    // Mapear a {student, nextBirthday: Date}
    const today = new Date();
    const birthdays = filtered
      .filter(s => !!s.birthdate)
      .map(s => {
        const birth = new Date(s.birthdate);
        const next = new Date(today);
        next.setMonth(birth.getMonth());
        next.setDate(birth.getDate());
        // Si el cumple cayó este año pero ya pasó, ir al año que viene
        if (
          next.getMonth() < today.getMonth() ||
          (next.getMonth() === today.getMonth() && next.getDate() < today.getDate())
        ) {
          next.setFullYear(today.getFullYear() + 1);
        } else {
          next.setFullYear(today.getFullYear());
        }
        return { student: s, nextBirthday: next };
      })
      // Ordenar por proximidad
      .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());

    // Solo los 2 primeros
    return birthdays.slice(0, 2);
  }

  const nextBirthdays = getUpcomingBirthdays();

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Cargando calendario...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Mostrar próximos 2 cumpleaños */}
      {!studentsLoading && nextBirthdays.length > 0 && (
        <Card className="mb-6 bg-gradient-to-br from-yellow-100 to-white border-yellow-300/70">
          <CardHeader>
            <CardTitle>Próximos Cumpleaños</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {nextBirthdays.map(({ student, nextBirthday }) => (
                <div key={student.id} className="flex items-center gap-2">
                  <span className="font-medium">{student.first_name} {student.last_name}</span>
                  <span className="text-muted-foreground text-sm">
                    {nextBirthday.toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({student.assigned_class ? `Clase ${student.assigned_class}` : student.department})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calendario de Eventos</CardTitle>
          <Dialog 
            open={dialogOpen} 
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setSelectedEvent(null);
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Agregar Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                </DialogTitle>
              </DialogHeader>
              <EventForm 
                onSubmit={handleCreateEvent} 
                initialData={selectedEvent || undefined}
                onSuccess={() => {
                  setDialogOpen(false);
                  setSelectedEvent(null);
                }}
              />
              {selectedEvent && (
                <DialogFooter className="mt-4 flex justify-between">
                  <Button 
                    variant="destructive" 
                    type="button"
                    onClick={(e) => handleDeleteClick(selectedEvent, e)}
                    className="flex items-center"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Evento
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-md border shadow-sm p-4 flex justify-center dark:bg-gray-800 dark:border-gray-700">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={handleMonthChange}
                className="w-full"
                locale={es}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayEvents = eventDates[dateStr];

                    if (!dayEvents) {
                      return <span>{date.getDate()}</span>;
                    }

                    const allPastEvents = dayEvents.every(event => 
                      isBefore(new Date(event.date), new Date())
                    );

                    return (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span 
                            className={`cursor-pointer w-full h-full flex items-center justify-center ${
                              allPastEvents 
                                ? 'bg-[#ea384c]/10 dark:bg-[#4e2a2a]/70' 
                                : 'bg-[#F2FCE2] dark:bg-[#2a4e27]/70'
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 dark:bg-gray-800 dark:border-gray-700">
                          <div className="space-y-2">
                            {dayEvents.map((event) => {
                              const isPastEvent = isBefore(new Date(event.date), new Date());
                              return (
                                <div 
                                  key={event.id} 
                                  className={`p-2 rounded-md cursor-pointer ${
                                    isPastEvent 
                                      ? "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70" 
                                      : "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70"
                                  }`}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-semibold dark:text-white">{event.title}</h4>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-7 w-7 p-0" 
                                      onClick={(e) => handleDeleteClick(event, e)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/90" />
                                    </Button>
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-line dark:text-gray-300">{event.description}</p>
                                </div>
                              );
                            })}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">
                Eventos del mes {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
              </h3>
              <div className="space-y-2">
                {currentMonthEvents.length > 0 ? (
                  <div className="overflow-hidden rounded-md border">
                    <div className="bg-primary/10 dark:bg-primary/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold text-primary w-16">Fecha</TableHead>
                            <TableHead className="font-semibold text-primary">Título</TableHead>
                            <TableHead className="font-semibold text-primary w-16">Hora</TableHead>
                            <TableHead className="font-semibold text-primary w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                      </Table>
                    </div>
                    <ScrollArea className="h-[250px]">
                      <Table>
                        <TableBody>
                          {currentMonthEvents.map((event) => (
                            <TableRow 
                              key={event.id} 
                              className={`hover:bg-muted/50 cursor-pointer transition-colors duration-200 ${
                                isAfter(new Date(event.date), new Date()) 
                                ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70" 
                                : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70"
                              }`}
                              onClick={() => handleEventClick(event)}
                            >
                              <TableCell className="font-medium w-16">
                                {format(new Date(event.date), 'dd/MM')}
                              </TableCell>
                              <TableCell>{event.title}</TableCell>
                              <TableCell className="w-16">
                                {event.time || "-"}
                              </TableCell>
                              <TableCell className="w-10">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-7 w-7 p-0" 
                                  onClick={(e) => handleDeleteClick(event, e)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/90" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-muted-foreground dark:text-gray-400">No hay eventos este mes</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              ¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
