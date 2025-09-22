// src/lib/firebase-supabase.ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { getAnalytics } from 'firebase/analytics';
import { supabase } from "@/integrations/supabase/client";
// Tu configuración de Firebase (la misma que ya tienes)
const firebaseConfig = {
  apiKey: "AIzaSyCwveY6gv9TCaaLUkp9ZyaHLKSlJgsB1h4",
  authDomain: "appccdt.firebaseapp.com",
  projectId: "appccdt",
  storageBucket: "appccdt.firebasestorage.app",
  messagingSenderId: "807401870234",
  appId: "1:807401870234:web:cb58cd39de14bbbedd2023",
  measurementId: "G-PWC58EVX21"
};

// Tu VAPID Key - Reemplaza con la real desde Firebase Console
const VAPID_KEY = "TU_VAPID_KEY_AQUI";

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
let messaging: any = null;
let analytics: any = null;

// Verificar si estamos en el navegador
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Firebase services not available:', error);
  }
}

// Tipos para notificaciones
interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
}

interface NotificationToken {
  id?: string;
  user_id: string;
  token: string;
  device_info?: string;
  created_at?: string;
  updated_at?: string;
}

// Función para registrar el service worker
export const registerServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registrado exitosamente:', registration);
      return true;
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
      return false;
    }
  }
  return false;
};

// Función para obtener información del dispositivo
const getDeviceInfo = (): string => {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  
  return JSON.stringify({
    userAgent: userAgent.substring(0, 100), // Limitar longitud
    platform,
    language,
    timestamp: new Date().toISOString()
  });
};

// Función para guardar token en Supabase
const saveTokenToSupabase = async (token: string, userId: string): Promise<boolean> => {
  try {
    const deviceInfo = getDeviceInfo();
    
    // Intentar actualizar token existente del usuario, o crear uno nuevo
    const { data, error } = await supabase
      .from('notification_tokens')
      .upsert(
        {
          user_id: userId,
          token: token,
          device_info: deviceInfo,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: false
        }
      );

    if (error) {
      console.error('Error guardando token en Supabase:', error);
      return false;
    }

    console.log('Token guardado en Supabase exitosamente');
    return true;
  } catch (error) {
    console.error('Error en saveTokenToSupabase:', error);
    return false;
  }
};

// Función para obtener el ID del usuario actual desde Supabase
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
    
    return user.id;
  } catch (error) {
    console.error('Error en getCurrentUserId:', error);
    return null;
  }
};

// Función para solicitar permisos de notificación
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!messaging) {
    console.error('Firebase Messaging no está disponible');
    return null;
  }

  try {
    // Solicitar permisos
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Permisos de notificación denegados');
      return null;
    }

    // Registrar service worker si no está registrado
    await registerServiceWorker();

    // Obtener token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (token) {
      console.log('Token de FCM obtenido:', token);
      
      // Obtener ID del usuario actual
      const userId = await getCurrentUserId();
      
      if (userId) {
        // Guardar token en Supabase
        await saveTokenToSupabase(token, userId);
      } else {
        console.warn('No se pudo obtener el ID del usuario para guardar el token');
      }
      
      return token;
    } else {
      console.log('No se pudo obtener el token de FCM');
      return null;
    }
  } catch (error) {
    console.error('Error obteniendo permisos de notificación:', error);
    return null;
  }
};

// Función para manejar mensajes en primer plano
export const setupForegroundMessageListener = (
  onMessageReceived: (payload: MessagePayload) => void
): (() => void) | null => {
  if (!messaging) return null;

  return onMessage(messaging, (payload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    onMessageReceived(payload);
  });
};

// Función para enviar notificación usando Supabase Edge Function
export const sendNotification = async (
  notificationData: NotificationData,
  targetUserId?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: {
        title: notificationData.title,
        body: notificationData.body,
        icon: notificationData.icon || '/fire.png',
        data: notificationData.data || {},
        targetUserId: targetUserId,
      }
    });

    if (error) {
      console.error('Error enviando notificación:', error);
      return false;
    }

    console.log('Notificación enviada exitosamente:', data);
    return true;
  } catch (error) {
    console.error('Error en sendNotification:', error);
    return false;
  }
};

// Función específica para notificar nueva solicitud
export const notifyNewRequest = async (
  requestData: {
    title: string;
    date: string;
    requesterName: string;
    department: string;
  }
): Promise<boolean> => {
  const notificationData: NotificationData = {
    title: '📋 Nueva Solicitud de Evento',
    body: `${requestData.requesterName} ha solicitado: "${requestData.title}" para el ${requestData.date}`,
    icon: '/fire.png',
    data: {
      type: 'new_request',
      action: 'view_requests',
      ...requestData,
    },
  };

  // Enviar a todos los administradores y secretarias (sin targetUserId)
  return await sendNotification(notificationData);
};

// Función para notificar estado de solicitud (aprobada/rechazada)
export const notifyRequestStatus = async (
  requestData: {
    title: string;
    status: 'approved' | 'rejected';
    reason?: string;
  },
  targetUserId: string
): Promise<boolean> => {
  const isApproved = requestData.status === 'approved';
  
  const notificationData: NotificationData = {
    title: isApproved ? '✅ Solicitud Aprobada' : '❌ Solicitud Rechazada',
    body: isApproved 
      ? `Tu solicitud "${requestData.title}" ha sido aprobada`
      : `Tu solicitud "${requestData.title}" ha sido rechazada${requestData.reason ? `: ${requestData.reason}` : ''}`,
    icon: '/fire.png',
    data: {
      type: 'request_status_update',
      action: 'view_my_requests',
      status: requestData.status,
      ...requestData,
    },
  };

  return await sendNotification(notificationData, targetUserId);
};

// Función para verificar si las notificaciones están habilitadas
export const areNotificationsEnabled = (): boolean => {
  return Notification.permission === 'granted';
};

// Función para obtener el estado de los permisos
export const getNotificationPermissionStatus = (): NotificationPermission => {
  return Notification.permission;
};

// Función para obtener tokens guardados (para administración)
export const getNotificationTokens = async (): Promise<NotificationToken[]> => {
  try {
    const { data, error } = await supabase
      .from('notification_tokens')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo tokens:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en getNotificationTokens:', error);
    return [];
  }
};

// Función para eliminar token (cuando usuario cierra sesión)
export const removeNotificationToken = async (userId?: string): Promise<boolean> => {
  try {
    const userIdToRemove = userId || await getCurrentUserId();
    
    if (!userIdToRemove) {
      console.warn('No se pudo obtener el ID del usuario para eliminar token');
      return false;
    }

    const { error } = await supabase
      .from('notification_tokens')
      .delete()
      .eq('user_id', userIdToRemove);

    if (error) {
      console.error('Error eliminando token:', error);
      return false;
    }

    console.log('Token eliminado exitosamente');
    return true;
  } catch (error) {
    console.error('Error en removeNotificationToken:', error);
    return false;
  }
};

// Función para configurar listeners de Supabase real-time (opcional)
export const setupSupabaseRealtimeListener = (
  onNewRequest: (payload: any) => void,
  onRequestUpdate: (payload: any) => void
) => {
  // Escuchar nuevas solicitudes
  const requestsChannel = supabase
    .channel('requests_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'events',
        filter: 'solicitud=eq.true'
      },
      (payload) => {
        console.log('Nueva solicitud detectada:', payload);
        onNewRequest(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'events',
        filter: 'solicitud=eq.false'
      },
      (payload) => {
        console.log('Solicitud actualizada:', payload);
        onRequestUpdate(payload);
      }
    )
    .subscribe();

  // Retornar función para cleanup
  return () => {
    supabase.removeChannel(requestsChannel);
  };
};

export { app, messaging, analytics };