// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { 
  requestNotificationPermission, 
  setupForegroundMessageListener,
  areNotificationsEnabled,
  notifyNewRequest,
  notifyRequestStatus,
  getNotificationPermissionStatus
} from '@/lib/firebase-supabase';
import { useToast } from '@/components/ui/use-toast';
import { MessagePayload } from 'firebase/messaging';

interface NotificationHookReturn {
  isEnabled: boolean;
  permissionStatus: NotificationPermission;
  token: string | null;
  isLoading: boolean;
  requestPermission: () => Promise<string | null>;
  sendNewRequestNotification: (requestData: {
    title: string;
    date: string;
    requesterName: string;
    department: string;
  }) => Promise<boolean>;
  sendStatusUpdateNotification: (
    requestData: {
      title: string;
      status: 'approved' | 'rejected';
      reason?: string;
    },
    targetUserId: string
  ) => Promise<boolean>;
}

export const useNotifications = (): NotificationHookReturn => {
  const [isEnabled, setIsEnabled] = useState(areNotificationsEnabled());
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    getNotificationPermissionStatus()
  );
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Función para solicitar permisos
  const requestPermission = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const newToken = await requestNotificationPermission();
      
      if (newToken) {
        setToken(newToken);
        setIsEnabled(true);
        setPermissionStatus('granted');
        
        toast({
          title: "✅ Notificaciones habilitadas",
          description: "Ahora recibirás notificaciones sobre solicitudes y eventos.",
        });
        
        return newToken;
      } else {
        setIsEnabled(false);
        setPermissionStatus(getNotificationPermissionStatus());
        
        if (getNotificationPermissionStatus() === 'denied') {
          toast({
            title: "❌ Notificaciones bloqueadas",
            description: "Las notificaciones están bloqueadas. Puedes habilitarlas desde la configuración del navegador.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "⚠️ Notificaciones no disponibles",
            description: "No se pudieron habilitar las notificaciones en este momento.",
            variant: "destructive",
          });
        }
        
        return null;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      
      toast({
        title: "❌ Error",
        description: "Hubo un problema al habilitar las notificaciones.",
        variant: "destructive",
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Función para enviar notificación de nueva solicitud
  const sendNewRequestNotification = useCallback(async (requestData: {
    title: string;
    date: string;
    requesterName: string;
    department: string;
  }): Promise<boolean> => {
    try {
      const success = await notifyNewRequest(requestData);
      
      if (success) {
        console.log('Notificación de nueva solicitud enviada exitosamente');
      } else {
        console.error('Error enviando notificación de nueva solicitud');
      }
      
      return success;
    } catch (error) {
      console.error('Error in sendNewRequestNotification:', error);
      return false;
    }
  }, []);

  // Función para enviar notificación de cambio de estado
  const sendStatusUpdateNotification = useCallback(async (
    requestData: {
      title: string;
      status: 'approved' | 'rejected';
      reason?: string;
    },
    targetUserId: string
  ): Promise<boolean> => {
    try {
      const success = await notifyRequestStatus(requestData, targetUserId);
      
      if (success) {
        console.log('Notificación de cambio de estado enviada exitosamente');
      } else {
        console.error('Error enviando notificación de cambio de estado');
      }
      
      return success;
    } catch (error) {
      console.error('Error in sendStatusUpdateNotification:', error);
      return false;
    }
  }, []);

  // Manejar mensajes en primer plano
  const handleForegroundMessage = useCallback((payload: MessagePayload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    
    const { notification, data } = payload;
    
    if (notification) {
      // Mostrar toast personalizado según el tipo de notificación
      const notificationType = data?.type;
      
      if (notificationType === 'new_request') {
        toast({
          title: notification.title || "Nueva Solicitud",
          description: notification.body || "Tienes una nueva solicitud pendiente",
          duration: 5000,
        });
      } else if (notificationType === 'request_status_update') {
        const isApproved = data?.status === 'approved';
        toast({
          title: notification.title || "Actualización de Solicitud",
          description: notification.body || "El estado de tu solicitud ha cambiado",
          variant: isApproved ? "default" : "destructive",
          duration: 5000,
        });
      } else {
        // Notificación genérica
        toast({
          title: notification.title || "Nueva Notificación",
          description: notification.body || "Tienes una nueva notificación",
          duration: 5000,
        });
      }
    }
  }, [toast]);

  // Configurar listener para mensajes en primer plano
  useEffect(() => {
    const unsubscribe = setupForegroundMessageListener(handleForegroundMessage);
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleForegroundMessage]);

  // Escuchar mensajes del service worker
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
        console.log('Notificación clickeada desde service worker:', event.data);
        
        // Aquí puedes manejar la navegación o acciones adicionales
        const { action, targetUrl, data } = event.data;
        
        // Ejemplo de navegación (ajustar según tu router)
        if (targetUrl && window.location.pathname !== targetUrl) {
          window.location.href = targetUrl;
        }
        
        // Mostrar toast informativo
        toast({
          title: "📱 Notificación",
          description: "Navegando desde notificación...",
          duration: 2000,
        });
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [toast]);

  // Verificar estado inicial de permisos
  useEffect(() => {
    const checkInitialPermission = () => {
      const currentStatus = getNotificationPermissionStatus();
      const currentEnabled = areNotificationsEnabled();
      
      setPermissionStatus(currentStatus);
      setIsEnabled(currentEnabled);
      
      // Si los permisos están concedidos pero no tenemos token, intentar obtenerlo
      if (currentEnabled && !token) {
        requestNotificationPermission().then((newToken) => {
          if (newToken) {
            setToken(newToken);
          }
        });
      }
    };

    checkInitialPermission();
  }, [token]);

  // Mostrar recordatorio de notificaciones si no están habilitadas
  useEffect(() => {
    const showNotificationReminder = () => {
      if (permissionStatus === 'default') {
        // Mostrar recordatorio después de un tiempo si no se han habilitado
        const timer = setTimeout(() => {
          toast({
            title: "🔔 ¿Quieres recibir notificaciones?",
            description: "Habilita las notificaciones para estar al día con las solicitudes de eventos.",
            duration: 8000,
          });
        }, 10000); // Mostrar después de 10 segundos
        
        return () => clearTimeout(timer);
      }
    };

    return showNotificationReminder();
  }, [permissionStatus, toast]);

  return {
    isEnabled,
    permissionStatus,
    token,
    isLoading,
    requestPermission,
    sendNewRequestNotification,
    sendStatusUpdateNotification,
  };
};