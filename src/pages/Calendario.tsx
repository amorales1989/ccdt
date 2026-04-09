import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MuiCalendar } from "@/components/MuiCalendar";
import { Badge } from "@/components/ui/badge";
import { getEvents, deleteEvent, updateEvent, notifyNewRequest, getUsers, notifyRequestResponse, notifyMassiveApprovedEvent } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
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
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { format, isBefore, startOfDay, isSameMonth, isAfter, startOfMonth, endOfMonth, parseISO, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createEvent } from "@/lib/api";
import type { Event, Profile } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { CustomTabs } from "@/components/CustomTabs";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle, XCircle, AlertCircle, Clock4, Building, User, FileText as FileTextIcon, Clock, CalendarPlus, Trash2, Calendar as CalendarIcon, Check, X } from "lucide-react";
import { EventForm } from "@/components/EventForm";

export default function Calendario() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState((location.state as any)?.activeTab || "calendario");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<Event[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Fecha no disponible");
  const [selectedRequest, setSelectedRequest] = useState<Event | null>(null);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Determinar si el usuario puede crear eventos
  const selectedDepartmentStorage = localStorage.getItem('selectedDepartment');
  const isCalendarDepartment = selectedDepartmentStorage === 'calendario' || profile?.departments?.[0] === 'calendario';
  const isSecretaria = profile?.role === 'secretaria';
  const isAdmin = profile?.role === 'admin';
  const isSecrCalendario = profile?.role === 'secr.-calendario';
  const canCreateEvents = isSecretaria || isAdmin || isSecrCalendario;

  const queryClient = useQueryClient();

  const { data: allEvents = [], isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  useEffect(() => {
    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }
  }, [location.state]);

  // Filtrar solicitudes según permisos (Lógica de solicitudes.tsx)
  const filteredRequests = useMemo(() => {
    let filtered;
    if (canCreateEvents) {
      // Para gestores: solo mostrar solicitudes PENDIENTES
      filtered = allEvents.filter(event => {
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        return esSolicitud;
      });
    } else {
      // Para usuarios regulares: mostrar sus últimas 10 solicitudes
      filtered = allEvents.filter(event => {
        const solicitanteId = (event as any).solicitante;
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        const tieneEstado = (event as any).estado === 'aprobada' || (event as any).estado === 'rechazada';
        return solicitanteId === profile?.id && (esSolicitud || tieneEstado);
      });
    }
    return filtered.sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );
  }, [allEvents, canCreateEvents, profile?.id]);

  // Obtener usuarios para mostrar nombres en solicitudes
  const { data: users = [] as Profile[] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!profile && (isAdmin || isSecretaria || isSecrCalendario)
  });

  const getUserName = (userId: string): string => {
    const user = (users as Profile[]).find((u) => u.id === userId);
    if (!user) return 'Usuario no encontrado';
    return `${user.first_name.trim()} ${user.last_name.trim()}`.trim();
  };
  const events = allEvents.filter(event => {
    // Si no puede gestionar solicitudes, no mostrar eventos con solicitud: true
    if (!canCreateEvents && (event as any).solicitud === true) {
      return false;
    }
    // No mostrar solicitudes rechazadas para ningún rol
    if ((event as any).estado === 'rechazada') {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (selectedDate && events.length > 0) {
      const filtered = events
        .filter(event => isSameMonth(parseISO(event.date), selectedDate))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCurrentMonthEvents(filtered);
    }
  }, [selectedDate, events]);

  const eventDates = events.reduce((acc: Record<string, any[]>, event) => {
    try {
      const startDate = parseISO(event.date);
      let eventRange = [startDate];

      if (event.end_date) {
        const endDate = parseISO(event.end_date);
        if (!isBefore(endDate, startDate)) {
          eventRange = eachDayOfInterval({ start: startDate, end: endDate });
        }
      }

      eventRange.forEach((day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        // Avoid duplicates if the event is spanning across months or something
        if (!acc[dateStr].find(e => e.id === event.id)) {
          acc[dateStr].push(event);
        }
      });
    } catch (e) {
      console.error(e);
    }
    return acc;
  }, {});

  // Verificar si el usuario puede editar un evento específico
  const canEditEvent = (event: Event) => {
    if (canCreateEvents) return true;
    // Si es una solicitud propia, puede editarla (verificar por solicitante)
    return (event as any).solicitante === profile?.id;
  };

  const handleCreateEvent = async (eventData: any) => {
    try {
      if (selectedEvent) {
        // Actualizar evento existente
        await updateEvent(selectedEvent.id, {
          ...eventData,
          id: selectedEvent.id
        });
        toast({
          title: (isSecretaria || isAdmin || isSecrCalendario) ? "Evento actualizado" : "Solicitud actualizada",
          description: (isSecretaria || isAdmin || isSecrCalendario)
            ? "El evento se ha actualizado exitosamente."
            : "La solicitud se ha actualizado exitosamente.",
        });
      } else {
        // Crear nuevo evento/solicitud
        const dataToSend = {
          ...eventData
        };

        // Si no puede crear eventos directamente (es una solicitud)
        if (!canCreateEvents && profile?.id) {
          dataToSend.solicitante = profile.id;
        }

        // Crear el evento/solicitud
        const newEvent = await createEvent(dataToSend);

        // Si es una solicitud (usuario sin permisos), enviar notificación por email
        if (!canCreateEvents && profile) {
          try {
            const requesterName = profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`.trim()
              : profile.email || 'Usuario no identificado';

            await notifyNewRequest({
              eventTitle: eventData.title,
              eventDate: eventData.date,
              eventEndDate: eventData.end_date,
              eventTime: eventData.time,
              eventEndTime: eventData.end_time,
              department: eventData.departamento,
              requesterName: requesterName,
              description: eventData.description,
              adminEmails: [
                'a19morales89@gmail.com',
                'wmaldonado1987@hotmail.com',
                'daniela.s.galarza86@gmail.com',
                'amonima115@hotmail.com',
                'marcelaponceabril@gmail.com',
                'comunidadcristianadontorcuato@gmail.com'
              ]
            });

            toast({
              title: "Solicitud enviada",
              description: "Tu solicitud ha sido enviada exitosamente.",
            });
          } catch (emailError) {
            console.error('Error sending notification email:', emailError);
            // No fallar la creación del evento por error de email
            toast({
              title: "Solicitud creada",
              description: "La solicitud se ha creado, pero no se pudo enviar la notificación por email.",
              variant: "destructive",
            });
          }
        } else {
          // Para administradores/secretarias (evento directo)
          toast({
            title: "Evento creado",
            description: "El evento se ha creado exitosamente.",
          });
        }
      }

      await refetch();
      setDialogOpen(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error("Error creating/updating event:", error);
      toast({
        title: "Error",
        description: selectedEvent
          ? ((isSecretaria || isAdmin || isSecrCalendario) ? "No se pudo actualizar el evento." : "No se pudo actualizar la solicitud.")
          : ((isSecretaria || isAdmin || isSecrCalendario) ? "No se pudo crear el evento." : "No se pudo enviar la solicitud."),
        variant: "destructive",
      });
    }
  };

  const handleEventClick = (event: Event) => {
    const isPendingRequest = (event as any).solicitud === true && (event as any).estado === 'solicitud';
    if (isPendingRequest && canCreateEvents) {
      setSelectedRequest(event);
      setRequestDetailOpen(true);
    } else {
      setSelectedEvent(event);
      setDialogOpen(true);
    }
  };

  const handleDeleteClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      await deleteEvent(eventToDelete.id);
      await refetch();
      toast({
        title: (isSecretaria || isAdmin || isSecrCalendario) ? "Evento eliminado" : "Solicitud eliminada",
        description: (isSecretaria || isAdmin || isSecrCalendario)
          ? "El evento se ha eliminado exitosamente."
          : "La solicitud se ha eliminado exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (isSecretaria || isAdmin || isSecrCalendario)
          ? "No se pudo eliminar el evento."
          : "No se pudo eliminar la solicitud.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  // Mutaciones para aprobar y rechazar solicitudes
  const { mutate: approveRequest } = useMutation({
    mutationFn: async (eventId: string) => {
      return updateEvent(eventId, {
        solicitud: false,
        estado: 'aprobada'
      });
    },
    onSuccess: async (_, eventId) => {
      // Notificación por email (Lógica de solicitudes.tsx)
      const event = allEvents.find(e => e.id === eventId);
      if (event && event.solicitante) {
        const user = users.find(u => u.id === event.solicitante);
        if (user && user.email) {
          try {
            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: `${user.first_name} ${user.last_name}`,
              requesterEmail: user.email,
              estado: 'aprobado',
              solicitante_id: event.solicitante,
              adminMessage: 'Tu solicitud ha sido aprobada.'
            });
          } catch (e) { console.error(e); }
        }
      }

      // IMPORTANTE: Disparar notificación masiva de aprobación.
      if (event) {
        try {
          await notifyMassiveApprovedEvent({
            eventTitle: event.title,
            eventDate: event.date,
            description: event.description || ''
          });
        } catch (e) { console.error("Error en notifyMassiveApprovedEvent:", e); }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud ha sido aprobada.",
      });
      setDialogOpen(false);
      setSelectedEvent(null);
      setSelectedRequest(null);
    }
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      return updateEvent(eventId, {
        estado: 'rechazada',
        motivoRechazo: reason
      } as any);
    },
    onSuccess: async (_, { eventId, reason }) => {
      const event = allEvents.find(e => e.id === eventId);
      if (event && event.solicitante) {
        const user = users.find(u => u.id === event.solicitante);
        if (user && user.email) {
          try {
            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: `${user.first_name} ${user.last_name}`,
              requesterEmail: user.email,
              estado: 'rechazado',
              adminMessage: reason,
              solicitante_id: event.solicitante,
            });
          } catch (e) { console.error(e); }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud ha sido rechazada.",
      });
      setDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedEvent(null);
      setSelectedRequest(null);
    }
  });

  const handleApproveRequest = (eventId: string) => {
    approveRequest(eventId);
  };

  const handleRejectRequest = (eventId: string) => {
    setSelectedRequest(allEvents.find(e => e.id === eventId) || null);
    setRejectReason("Fecha no disponible");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedRequest && rejectReason.trim()) {
      rejectRequest({ eventId: selectedRequest.id, reason: rejectReason.trim() });
    }
  };

  const getStatusBadge = (event: any) => {
    const isSolicitud = event.solicitud === true && event.estado === 'solicitud';
    const estado = event.estado || 'pendiente';

    if (isSolicitud) {
      return (
        <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Clock4 className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }

    const variants: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'aprobada': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'rechazada': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };

    return (
      <Badge className={`ml-2 ${variants[estado] || variants['pendiente']} flex items-center gap-1`}>
        {estado === 'aprobada' && <CheckCircle className="h-3 w-3" />}
        {estado === 'rechazada' && <XCircle className="h-3 w-3" />}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  if (isLoading) {
    return <LoadingOverlay message="Cargando calendario..." />;
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Calendario de Eventos</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {(isSecretaria || isAdmin || isSecrCalendario) ? "Gestioná los eventos y solicitudes de la congregación." : "Consultá y solicitá nuevas fechas para tus actividades."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateEvents ? (
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setSelectedEvent(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button className="button-gradient shadow-lg shadow-primary/20 rounded-xl font-bold px-6 h-12">
                    <CalendarPlus className="mr-2 h-5 w-5" />
                    Nuevo Evento
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto">
                  <div className="p-6 sm:p-8">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 dark:text-slate-100">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-2xl text-purple-600 dark:text-purple-400">
                          {selectedEvent ? <CalendarIcon className="h-6 w-6" /> : <CalendarPlus className="h-6 w-6" />}
                        </div>
                        {selectedEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                        {selectedEvent && getStatusBadge(selectedEvent)}
                      </DialogTitle>
                    </DialogHeader>
                    <EventForm
                      onSubmit={handleCreateEvent}
                      initialData={selectedEvent || undefined}
                      isRequestMode={false}
                      onSuccess={() => {
                        setDialogOpen(false);
                        setSelectedEvent(null);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setSelectedEvent(null);
                }}
              >
                <DialogTrigger asChild>
                  <Button className="button-gradient shadow-lg shadow-primary/20 rounded-xl font-bold px-6 h-12">
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    Solicitar Fecha
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto">
                  <div className="p-6 sm:p-8">
                    <DialogHeader className="mb-6">
                      <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 dark:text-slate-100">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-2xl text-purple-600 dark:text-purple-400">
                          <CalendarPlus className="h-6 w-6" />
                        </div>
                        Solicitar Nueva Fecha
                      </DialogTitle>
                    </DialogHeader>
                    <EventForm
                      onSubmit={handleCreateEvent}
                      initialData={selectedEvent || undefined}
                      isRequestMode={true}
                      onSuccess={() => {
                        setDialogOpen(false);
                        setSelectedEvent(null);
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats and Tabs Row */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="glass-card flex items-center gap-6 px-6 py-4 lg:w-auto overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="whitespace-nowrap">
                <div className="text-xl font-black text-primary leading-none">
                  {currentMonthEvents.length}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Eventos Mes</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-100 shrink-0" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
                <Clock4 className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="whitespace-nowrap">
                <div className="text-xl font-black text-yellow-600 leading-none">
                  {filteredRequests.length}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Solicitudes</div>
              </div>
            </div>
          </div>

          <div className="glass-card flex-1 flex items-center justify-center lg:justify-start px-2 py-2 overflow-x-auto no-scrollbar">
            <CustomTabs
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "calendario", label: "Calendario", icon: CalendarIcon },
                { value: "solicitudes", label: `Solicitudes`, icon: ClipboardCheck }
              ]}
            />
          </div>
        </div>

        {activeTab === "calendario" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* Calendario visual (Izquierda - 5 cols) */}
            <div className="lg:col-span-5">
              <Card className="glass-card border-none shadow-xl overflow-hidden p-2 h-fit bg-white/40">
                <MuiCalendar
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  onMonthChange={handleMonthChange}
                  eventDates={eventDates}
                  renderDayWithEvents={(date, dayEvents) => {
                    return (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span className="absolute inset-0 cursor-pointer" />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 glass-card-dark" style={{ zIndex: 9999 }}>
                          <div className="space-y-3 p-1">
                            {dayEvents.map((event) => {
                              const isPastEvent = isBefore(parseISO(event.date), startOfDay(new Date()));
                              return (
                                <div
                                  key={event.id}
                                  className={`p-4 rounded-2xl cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${isPastEvent
                                    ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20'
                                    : 'bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20'
                                    }`}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">{event.title}</h4>
                                      {getStatusBadge(event)}
                                    </div>
                                    {canCreateEvents && canEditEvent(event) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 -mt-1 -mr-1 text-rose-500 hover:text-rose-600 hover:bg-rose-100"
                                        onClick={(e) => handleDeleteClick(event, e)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{event.description || 'Sin descripción'}</p>
                                </div>
                              );
                            })}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }}
                />
              </Card>
            </div>

            {/* Lista de eventos del mes (Derecha - 7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Próximos Eventos
                </h3>
                <Badge variant="outline" className="rounded-lg bg-white/50 border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-widest px-3 py-1">
                  {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
                </Badge>
              </div>

              <ScrollArea className="h-[calc(100vh-450px)] min-h-[400px] pr-4">
                <div className="space-y-4">
                  {currentMonthEvents.length > 0 ? (
                    currentMonthEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => handleEventClick(event)}
                        className="glass-card hover:bg-white/80 transition-all p-5 cursor-pointer group animate-fade-in"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 font-black shrink-0 border border-slate-100 dark:border-slate-800 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300 shadow-sm">
                            <span className="text-lg leading-none">{format(parseISO(event.date), 'dd')}</span>
                            <span className="text-[10px] uppercase opacity-70">{format(parseISO(event.date), 'MMM', { locale: es })}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate uppercase tracking-tight">
                                {event.title}
                              </h4>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary opacity-70" />
                                {event.time || "N/A"}{event.end_time ? ` - ${event.end_time} hs` : " hs"}
                              </div>
                              {(event as any).departamento && (
                                <div className="flex items-center gap-1.5">
                                  <Building className="h-3.5 w-3.5 text-primary opacity-70" />
                                  {(event as any).departamento}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            {canCreateEvents && canEditEvent(event) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(event, e);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="glass-card p-12 text-center border-dashed bg-white/20">
                      <CalendarIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay eventos para este mes</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.2em] flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {canCreateEvents ? "Solicitudes Pendientes" : "Mis Solicitudes"}
              </h3>
              <Badge variant="outline" className="rounded-lg bg-white/50 border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-widest px-3 py-1">
                {filteredRequests.length} Total
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.length === 0 ? (
                <div className="col-span-full glass-card p-20 text-center border-dashed bg-white/20">
                  <Clock4 className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
                    {canCreateEvents ? "No hay solicitudes pendientes" : "No has realizado solicitudes"}
                  </p>
                </div>
              ) : (
                filteredRequests.map((request: any) => (
                  <div
                    key={request.id}
                    onClick={() => handleEventClick(request)}
                    className="glass-card hover:bg-white/80 transition-all p-5 cursor-pointer group flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 truncate uppercase tracking-tight">
                          {request.title}
                        </h4>
                        {getStatusBadge(request)}
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <CalendarIcon className="h-3.5 w-3.5 text-primary opacity-70" />
                          {format(parseISO(request.date), 'dd/MM/yyyy')}
                          {request.end_date && request.end_date !== request.date && (
                            <span className="opacity-70 lowercase">al {format(parseISO(request.end_date), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <Clock className="h-3.5 w-3.5 text-indigo-500 opacity-70" />
                          {request.time || 'N/A'} {request.end_time && `- ${request.end_time} hs`}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <Building className="h-3.5 w-3.5 text-pink-500 opacity-70" />
                          {request.departamento || 'No especificado'}
                        </div>
                        {canCreateEvents && request.solicitante && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <User className="h-3.5 w-3.5 text-blue-500 opacity-70" />
                            {getUserName(request.solicitante)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Creado: {format(new Date(request.created_at || request.date), 'dd MMM', { locale: es })}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] font-black uppercase text-primary hover:bg-primary/5 rounded-lg">
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Confirmar eliminación"
          description={`¿Estás seguro de que deseas eliminar ${(isSecretaria || isAdmin || isSecrCalendario) ? "este evento" : "esta solicitud"}? Esta acción no se puede deshacer.`}
        />

        <Dialog open={requestDetailOpen} onOpenChange={setRequestDetailOpen}>
          <DialogContent className="w-[95vw] max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto">
            <div className="p-6 sm:p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-800 dark:text-slate-100">
                  <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2.5 rounded-2xl text-yellow-600 dark:text-yellow-400">
                    <Clock4 className="h-6 w-6" />
                  </div>
                  Detalles de la Solicitud
                  <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pendiente</Badge>
                </DialogTitle>
              </DialogHeader>

              {selectedRequest && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Título</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-lg uppercase">{selectedRequest.title}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Departamento</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 uppercase">{(selectedRequest as any).departamento || 'Sin departamento'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 uppercase">
                        {format(parseISO(selectedRequest.date), 'dd/MM/yyyy')}
                        {selectedRequest.end_date && selectedRequest.end_date !== selectedRequest.date && (
                          <span className="opacity-70 lowercase"> al {format(parseISO(selectedRequest.end_date), 'dd/MM/yyyy')}</span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horario</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 uppercase">
                        {selectedRequest.time || 'N/A'} {selectedRequest.end_time && `- ${selectedRequest.end_time} hs`}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</p>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-600 dark:text-slate-300 font-medium">
                        {selectedRequest.description || 'Sin descripción'}
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        handleRejectRequest(selectedRequest.id);
                        setRequestDetailOpen(false);
                      }}
                      className="w-full sm:w-auto font-bold text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Rechazar Solicitud
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        handleApproveRequest(selectedRequest.id);
                        setRequestDetailOpen(false);
                      }}
                      className="w-full sm:w-auto font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aprobar y Publicar
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="w-[95vw] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-red-200/50 dark:border-red-900/30 rounded-3xl p-6 sm:p-8 overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800 dark:text-slate-100">
                <XCircle className="h-6 w-6 text-red-500" />
                Motivo de Rechazo
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Mensaje para el solicitante:
                </label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explique el motivo del rechazo..."
                  className="min-h-[120px] resize-none rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-red-500/20 font-medium"
                  maxLength={500}
                />
              </div>

              {selectedRequest && (
                <div className="bg-red-50/50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-1">Solicitud:</p>
                  <p className="font-bold text-slate-800 dark:text-white uppercase">{selectedRequest.title}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {format(parseISO(selectedRequest.date), 'dd/MM/yyyy')}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectReason("Fecha no disponible");
                }}
                className="rounded-xl w-full font-bold h-11"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className="rounded-xl w-full font-bold h-11 shadow-lg shadow-red-500/20"
              >
                Confirmar Rechazo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}