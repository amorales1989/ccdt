import { useState, useCallback, useRef } from 'react';
import { configurarMensajeria, obtenerTokenActual } from '@/lib/firebase';
import { toast } from 'sonner'; // O 'react-toastify' si usas ese
import { supabase } from "@/integrations/supabase/client";
import {
  registrarTokenFcm,
  eliminarTokenFcm,
  suscribirATema,
  desuscribirDeTema
} from '@/lib/api';

export function useFcm() {
  const [fcmToken, setFcmToken] = useState(null);
  const [fcmSoportado, setFcmSoportado] = useState(false);
  const [fcmInicializado, setFcmInicializado] = useState(false);
  const [fcmDisponible, setFcmDisponible] = useState(false);
  const isAuthenticatedRef = useRef(false);

  // Normalizar datos de FCM (siempre vienen como strings)
  const normalizeData = useCallback((data = {}) => {
    const d = { ...data };

    if (typeof d.extra === 'string') {
      try { 
        d.extra = JSON.parse(d.extra); 
      } catch { 
        /* ignore */ 
      }
    }

    if (typeof d.esImportante === 'string') {
      d.esImportante = d.esImportante === 'true';
    }
    
    if (typeof d.mesaId === 'string' && /^\d+$/.test(d.mesaId)) {
      d.mesaId = Number(d.mesaId);
    }

    return d;
  }, []);

  // Acciones según tipo de notificación
  const accionesApp = useCallback(async (tipo, data) => {
    switch (tipo) {
      case 'llamada_servicio':
        console.log('Llamada de servicio:', data);
        toast.info(data.titulo || 'Nueva notificación');
        break;

      case 'nuevo_pedido':
        console.log('Nuevo pedido:', data);
        break;

      case 'pedido_actualizado':
        console.log('Pedido actualizado:', data);
        break;

      case 'mensaje_chat':
        console.log('Mensaje de chat:', data);
        break;

      case 'stock_bajo':
        console.log('Stock bajo:', data);
        break;

      case 'navegar':
        console.log('Navegar a:', data);
        break;

      case 'nuevo_evento':
        console.log('Nuevo evento:', data);
        toast.info(`Nuevo evento: ${data.titulo || 'Sin título'}`);
        break;

      case 'evento_aprobado':
        console.log('Evento aprobado:', data);
        toast.success(`Evento aprobado: ${data.titulo || 'Sin título'}`);
        break;

      case 'evento_rechazado':
        console.log('Evento rechazado:', data);
        toast.error(`Evento rechazado: ${data.titulo || 'Sin título'}`);
        break;

      default:
        console.log('Tipo no reconocido:', tipo, data);
        break;
    }
  }, []);

  // Mostrar notificación en foreground
  const mostrarNotificacion = useCallback(async (title, options) => {
    if (Notification.permission !== 'granted') {
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, options);
        return;
      }

      const n = new Notification(title, options);
      n.onclick = () => n.close();
    } catch (e) {
      console.error('[FCM] Error mostrando notificación:', e);
    }
  }, []);

  // Handler para mensajes en foreground
    const handleFcmForeground = useCallback((payload) => {
    const data = normalizeData(payload.data || {});
    const tipo = data.tipo || payload.notification?.title || 'desconocido';

    if (payload.notification && document.visibilityState === 'visible') {
      const { title, body } = payload.notification;
      mostrarNotificacion(title || 'Notificación', {
        body: body || data.body || 'Tienes una nueva notificación',
        icon: '/logo.svg',
        badge: '/logo.svg',
        data,
        tag: `fcm-${tipo}`,
        requireInteraction: true,
      });
    }

    accionesApp(String(tipo), data).catch(err => {
      console.error('Error ejecutando acción para tipo:', tipo, err);
    });
  }, [normalizeData, mostrarNotificacion, accionesApp]);

  // Registrar token en la API
  const registrarToken = useCallback(async (token, idLocal = null) => {
    if (!token) return;

    const { data: { user } } = await supabase.auth.getUser();
    try {
      await registrarTokenFcm({
        token,
        ua: navigator.userAgent,
        plataforma: 'web',
        idLocal,
        usuario_id: user?.id,
        role: user?.user_metadata?.role
      });
    } catch (error) {
      console.error('Error al registrar token FCM:', error);
      throw error;
    }
  }, []);

  // Eliminar token de la API
  const eliminarToken = useCallback(async (token) => {
    try {
      await eliminarTokenFcm(token);
    } catch (error) {
      console.error('Error al eliminar token FCM:', error);
      throw error;
    }
  }, []);

  // Suscribir a tema
  const suscribir = useCallback(async (token, tema) => {
    try {
      await suscribirATema({
        tokens: [token],
        tema
      });
    } catch (error) {
      console.error('Error al suscribir a tema:', error);
      throw error;
    }
  }, []);

  // Desuscribir de tema
  const desuscribir = useCallback(async (token, tema) => {
    try {
      await desuscribirDeTema({
        tokens: [token],
        tema
      });
    } catch (error) {
      console.error('Error al desuscribir de tema:', error);
      throw error;
    }
  }, []);

  // Inicializar FCM
const inicializarFcm = useCallback(async () => {

  if (fcmInicializado) {
    return { soportado: fcmSoportado, token: fcmToken };
  }

  try {
    const { soportado, token } = await configurarMensajeria(handleFcmForeground);
    
    setFcmSoportado(soportado);
    setFcmToken(token);
    setFcmInicializado(true);
    setFcmDisponible(soportado && !!token && isAuthenticatedRef.current);

    return { soportado, token };
  } catch (error) {
    console.error('[useFcm] Error completo:', error.message, error.stack);
    
    setFcmSoportado(false);
    setFcmToken(null);
    setFcmInicializado(true);
    setFcmDisponible(false);
    
    return { soportado: false, token: null };
  }
}, [fcmInicializado, fcmSoportado, fcmToken, handleFcmForeground]);

// Configurar FCM después del login
const configurarFcmPostLogin = useCallback(async (userData = {}) => {
  
  isAuthenticatedRef.current = true;

  let tokenActual = fcmToken;

  if (!tokenActual) {
    console.log('[useFcm] ❌ No hay token FCM, reinicializando...');
    try {
      const { soportado, token } = await inicializarFcm();
      
      if (!soportado || !token) {
        console.log('[useFcm] ❌ No se pudo inicializar');
        return;
      }

      tokenActual = token; // ← USAR ESTA VARIABLE LOCAL
      setFcmSoportado(soportado);
      setFcmToken(token);
    } catch (error) {
      console.error('[useFcm] ❌ Error reinicializando:', error);
      return;
    }
  }

  try {
    console.log('[useFcm] 📤 Llamando a registrarToken...');
    console.log('[useFcm] Token:', tokenActual?.substring(0, 30) + '...'); // ← USAR tokenActual
    
    // Registrar token en la API
    await registrarToken(tokenActual, userData.localId?.toString() || null); // ← USAR tokenActual
    
    console.log('[useFcm] ✅ Token registrado exitosamente');

    // COMENTAR TEMPORALMENTE LA SUSCRIPCIÓN A TEMAS
    /*
    if (userData.empresaId) {
      console.log('[useFcm] Suscribiendo a tema empresa-' + userData.empresaId);
      await suscribir(tokenActual, `empresa-${userData.empresaId}`);
    }
    
    if (userData.localId) {
      console.log('[useFcm] Suscribiendo a tema local-' + userData.localId);
      await suscribir(tokenActual, `local-${userData.localId}`);
    }
    */

    setFcmDisponible(true);
    console.log('[useFcm] ✅ Configuración completa');
  } catch (error) {
    console.error('[useFcm] Detalles del error:', error.message);
  }
}, [fcmToken, inicializarFcm, registrarToken]); // Quitar 'suscribir' de las dependencias por ahora

  // Limpiar FCM al logout
  const limpiarFcmAlLogout = useCallback(async () => {
    if (!fcmToken) return;

    try {
      await eliminarToken(fcmToken);
      
      setFcmDisponible(false);
      isAuthenticatedRef.current = false;
      
    } catch (error) {
      console.error('[FCM] Error al limpiar en logout:', error);
    }
  }, [fcmToken, eliminarToken]);

  // Refrescar token FCM
  const refrescarTokenFcm = useCallback(async () => {
    try {
      const nuevoToken = await obtenerTokenActual();
      
      if (nuevoToken && nuevoToken !== fcmToken) {
        setFcmToken(nuevoToken);
        console.log('[FCM] Token refrescado');
        return nuevoToken;
      }
      
      return fcmToken;
    } catch (error) {
      console.error('[FCM] Error al refrescar token:', error);
      return null;
    }
  }, [fcmToken]);

  // Verificar estado FCM
  const verificarEstadoFcm = useCallback(() => {
    return {
      soportado: fcmSoportado,
      token: !!fcmToken,
      inicializado: fcmInicializado,
      disponible: fcmDisponible
    };
  }, [fcmSoportado, fcmToken, fcmInicializado, fcmDisponible]);

  return {
    fcmToken,
    fcmSoportado,
    fcmDisponible,
    fcmInicializado,
    inicializarFcm,
    configurarFcmPostLogin,
    limpiarFcmAlLogout,
    refrescarTokenFcm,
    verificarEstadoFcm,
  };
}