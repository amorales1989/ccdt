import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getEvents, updateEvent, getUsers } from "@/lib/api";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Check, 
  X, 
  Calendar, 
  Clock, 
  Building, 
  ClipboardCheck,
  Clock4,
  FileText,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  BellOff
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Event } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

// Tipo para el usuario
interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  assigned_class: string;
  departments: string[];
  department_id: string;
}

export default function Solicitudes() {
  const [selectedRequest, setSelectedRequest] = useState<Event | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Fecha no disponible");
  
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Hook de notificaciones
  const {
    isEnabled: notificationsEnabled,
    permissionStatus,
    requestPermission,
    sendNewRequestNotification,
    sendStatusUpdateNotification,
    isLoading: notificationsLoading
  } = useNotifications();

  // Verificar permisos
  const canManageRequests = profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'secr.-calendario';

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000
  });

  // Función para obtener el nombre del usuario por ID
  const getUserName = (userId: string): string => {
    const user = users.find((u: User) => u.id === userId);
    if (!user) return 'Usuario no encontrado';
    return `${user.first_name.trim()} ${user.last_name.trim()}`.trim();
  };

  // Función para obtener el usuario completo por ID
  const getUser = (userId: string): User | null => {
    return users.find((u: User) => u.id === userId) || null;
  };

  // Función para obtener el badge de estado
  const getStatusBadge = (request: Event) => {
    const estado = (request as any).estado;
    const esSolicitud = (request as any).solicitud === true && (request as any).estado === 'solicitud';
    if (esSolicitud) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Clock4 className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }

    if (estado === 'aprobada') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Aprobada
        </Badge>
      );
    }

    if (estado === 'rechazada') {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Rechazada
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Sin estado
      </Badge>
    );
  };

  // Filtrar solicitudes según permisos
  const filteredRequests = useMemo(() => {
    let filtered;
    
    if (canManageRequests) {
      filtered = allEvents.filter(event => {
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        return esSolicitud;
      });
    } else {
      filtered = allEvents.filter(event => {
        const solicitanteId = (event as any).solicitante;
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        const tieneEstado = (event as any).estado === 'aprobada' || (event as any).estado === 'rechazada';
        
        return solicitanteId === profile?.id && (esSolicitud || tieneEstado);
      });
    }
    
    const sorted = filtered.sort((a, b) => 
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );
    
    if (!canManageRequests) {
      return sorted.slice(0, 10);
    }
    
    return sorted;
  }, [allEvents, canManageRequests, profile?.id]);

  // Mutación para aprobar solicitudes con notificación
  const { mutate: approveRequest } = useMutation({
    mutationFn: async (eventId: string) => {
      return updateEvent(eventId, {
        solicitud: false,
        estado: 'aprobada'
      });
    },
    onSuccess: async (_, eventId) => {
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // Buscar la solicitud aprobada para enviar notificación
      const approvedRequest = selectedRequest;
      if (approvedRequest) {
        const solicitanteId = (approvedRequest as any).solicitante;
        
        // Enviar notificación al solicitante
        if (solicitanteId) {
          try {
            await sendStatusUpdateNotification(
              {
                title: approvedRequest.title,
                status: 'approved'
              },
              solicitanteId
            );
            console.log('Notificación de aprobación enviada');
          } catch (error) {
            console.error('Error enviando notificación de aprobación:', error);
          }
        }
      }
      
      toast({
        title: "✅ Solicitud aceptada",
        description: "La solicitud ha sido aceptada y ahora es visible en el calendario. Se ha notificado al solicitante.",
      });
      
      setDetailsDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast({
        title: "❌ Error",
        description: "No se pudo aceptar la solicitud.",
        variant: "destructive",
      });
    }
  });

  // Mutación para rechazar solicitudes con notificación
  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      return updateEvent(eventId, {
        estado: 'rechazada',
        motivoRechazo: reason
      });
    },
    onSuccess: async (_, { eventId, reason }) => {
      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
      
      // Buscar la solicitud rechazada para enviar notificación
      const rejectedRequest = selectedRequest;
      if (rejectedRequest) {
        const solicitanteId = (rejectedRequest as any).solicitante;
        
        // Enviar notificación al solicitante
        if (solicitanteId) {
          try {
            await sendStatusUpdateNotification(
              {
                title: rejectedRequest.title,
                status: 'rejected',
                reason: reason
              },
              solicitanteId
            );
            console.log('Notificación de rechazo enviada');
          } catch (error) {
            console.error('Error enviando notificación de rechazo:', error);
          }
        }
      }
      
      toast({
        title: "❌ Solicitud rechazada",
        description: "La solicitud ha sido rechazada. Se ha notificado al solicitante.",
      });
      
      setDetailsDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason("Fecha no disponible");
    },
    onError: () => {
      toast({
        title: "❌ Error",
        description: "No se pudo rechazar la solicitud.",
        variant: "destructive",
      });
    }
  });

  const handleViewDetails = (request: Event) => {
    setSelectedRequest(request);
    setDetailsDialogOpen(true);
  };

  const handleApprove = () => {
    if (selectedRequest) {
      approveRequest(selectedRequest.id);
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      setRejectDialogOpen(true);
    }
  };

  const handleConfirmReject = () => {
    if (selectedRequest && rejectReason.trim()) {
      rejectRequest({ eventId: selectedRequest.id, reason: rejectReason.trim() });
    }
  };

  // Componente de estado de notificaciones
  const NotificationStatus = () => {
    if (!canManageRequests) return null; // Solo mostrar a gestores
    
    return (
      <div className="flex items-center gap-2 ml-auto">
        {notificationsEnabled ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Notificaciones ON
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={requestPermission}
            disabled={notificationsLoading}
            className="flex items-center gap-1"
          >
            <BellOff className="h-3 w-3" />
            {notificationsLoading ? 'Configurando...' : 'Habilitar Notificaciones'}
          </Button>
        )}
      </div>
    );
  };

  const isLoading = eventsLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Cargando solicitudes...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Título y descripción según permisos
  const pageTitle = canManageRequests 
    ? "Solicitudes Pendientes" 
    : "Mis Solicitudes";
  
  const pageDescription = canManageRequests 
    ? "Gestiona las solicitudes de eventos pendientes de aprobación"
    : "Revisa el estado de tus últimas 10 solicitudes de eventos";

  const emptyStateTitle = canManageRequests 
    ? "No hay solicitudes pendientes"
    : "No tienes solicitudes";

  const emptyStateDescription = canManageRequests 
    ? "Todas las solicitudes han sido procesadas o no hay nuevas solicitudes por revisar."
    : "Aún no has realizado ninguna solicitud de evento. Puedes crear una nueva solicitud desde el calendario.";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-6 w-6" />
                {pageTitle}
                <Badge variant="secondary" className="ml-2">
                  {filteredRequests.length}
                </Badge>
              </CardTitle>
              <p className="text-muted-foreground mt-2">{pageDescription}</p>
            </div>
            <NotificationStatus />
          </div>
        </CardHeader>
      </Card>

      {/* Lista de solicitudes */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock4 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">{emptyStateTitle}</h3>
              <p className="text-muted-foreground">
                {emptyStateDescription}
              </p>
              {canManageRequests && !notificationsEnabled && (
                <div className="mt-6">
                  <Button 
                    onClick={requestPermission}
                    disabled={notificationsLoading}
                    className="flex items-center gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    {notificationsLoading ? 'Configurando Notificaciones...' : 'Habilitar Notificaciones'}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Recibe notificaciones cuando lleguen nuevas solicitudes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => {
            const solicitanteId = (request as any).solicitante;
            const nombreSolicitante = solicitanteId ? getUserName(solicitanteId) : 'No especificado';
            
            return (
              <Card 
                key={request.id} 
                className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50"
                onClick={() => handleViewDetails(request)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Título y estado */}
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold">{request.title}</h3>
                        {getStatusBadge(request)}
                      </div>

                      {/* Información básica */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(request.date), "dd/MM/yyyy", { locale: es })}
                        </div>
                        
                        {request.time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {request.time}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          <span>Departamento:</span>
                          <span className="font-medium">
                            {(request as any).departamento || 'No especificado'}
                          </span>
                        </div>

                        {/* Mostrar solicitante solo si se tienen permisos de gestión */}
                        {canManageRequests && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>Solicitante:</span>
                            <span className="font-medium">
                              {nombreSolicitante}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Descripción (preview) */}
                      {request.description && (
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {request.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal de detalles */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {canManageRequests ? "Detalles de la Solicitud" : "Detalles de mi Solicitud"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* Estado */}
              <div className="flex items-center justify-center p-4 rounded-lg border">
                {getStatusBadge(selectedRequest)}
              </div>

              {/* Información del evento */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Título del evento</label>
                  <h3 className="text-xl font-semibold mt-1">{selectedRequest.title}</h3>
                </div>

                {/* Información del solicitante (solo para gestores) */}
                {canManageRequests && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Solicitado por</label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium text-lg">
                        {(selectedRequest as any).solicitante 
                          ? getUserName((selectedRequest as any).solicitante)
                          : 'No especificado'
                        }
                      </span>
                      {/* Mostrar rol del usuario si está disponible */}
                      {(selectedRequest as any).solicitante && (() => {
                        const user = getUser((selectedRequest as any).solicitante);
                        return user ? (
                          <Badge variant="outline" className="ml-2 capitalize">
                            {user.role}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha solicitada</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {format(new Date(selectedRequest.date), "dd/MM/yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Hora</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {selectedRequest.time || 'No especificada'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Departamento</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="h-4 w-4 text-primary" />
                      <span className="font-medium capitalize">
                        {(selectedRequest as any).departamento || 'No especificado'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Descripción */}
                {selectedRequest.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Descripción del evento</label>
                    <div className="mt-2 p-4 bg-muted/30 rounded-lg border">
                      <p className="whitespace-pre-line leading-relaxed">{selectedRequest.description}</p>
                    </div>
                  </div>
                )}

                {/* Motivo de rechazo (si existe) */}
                {(selectedRequest as any).motivoRechazo && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Motivo de rechazo</label>
                    <div className="mt-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-red-800 dark:text-red-200 leading-relaxed">
                        {(selectedRequest as any).motivoRechazo}
                      </p>
                    </div>
                  </div>
                )}

                {/* Información de solicitud */}
                <div className="pt-4 border-t">
                  <label className="text-sm font-medium text-muted-foreground">Información de la solicitud</label>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <p>Solicitud creada el {format(new Date(selectedRequest.created_at || selectedRequest.date), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
                    {selectedRequest.updated_at && selectedRequest.updated_at !== selectedRequest.created_at && (
                      <p>Última actualización: {format(new Date(selectedRequest.updated_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción - solo para gestores y solicitudes pendientes */}
          {canManageRequests && selectedRequest && ((selectedRequest as any).solicitud === true && (selectedRequest as any).estado === 'solicitud') && (
            <DialogFooter className="flex justify-center gap-4 pt-6 border-t">
              <Button 
                variant="default"
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 min-w-[140px]"
                onClick={handleApprove}
              >
                <Check className="h-5 w-5" />
                Aprobar Solicitud
              </Button>
              <Button 
                variant="destructive"
                size="lg"
                className="flex items-center gap-2 min-w-[140px]"
                onClick={handleReject}
              >
                <X className="h-5 w-5" />
                Rechazar Solicitud
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de motivo de rechazo */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Motivo de Rechazo
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Ingrese el motivo del rechazo:
              </label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo..."
                className="min-h-[100px] resize-none"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground mt-1 text-right">
                {rejectReason.length}/500 caracteres
              </div>
            </div>

            {selectedRequest && (
              <div className="bg-muted/30 p-3 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground">Solicitud a rechazar:</p>
                <p className="font-semibold">{selectedRequest.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedRequest.date), "dd/MM/yyyy", { locale: es })}
                  {selectedRequest.time && ` - ${selectedRequest.time}`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-center gap-3 pt-4">
            <Button 
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("Fecha no disponible");
              }}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}