import { useEffect, useRef } from 'react';
import { useFcm } from '@/hooks/useFcm';
import { useAuth } from '@/contexts/AuthContext';

export function NotificationHandler() {
  const { 
    inicializarFcm, 
    configurarFcmPostLogin, 
    limpiarFcmAlLogout,
  } = useFcm();
  
  const { user, profile } = useAuth();
  const setupComplete = useRef(false);

  // Inicializar y configurar FCM cuando el usuario esté autenticado
  useEffect(() => {
    if (user && profile && !setupComplete.current) {
      setupComplete.current = true;
      
      const setup = async () => {
        try {
          const { soportado, token } = await inicializarFcm();
          
          if (!soportado) {
            setupComplete.current = false;
            return;
          }
          
          if (!token) {
            setupComplete.current = false;
            return;
          }
          
          await configurarFcmPostLogin({
            empresaId: 1,
            localId: 1,
          });
                    
        } catch (error) {
          console.error('[NotificationHandler] ❌ Error:', error);
          setupComplete.current = false;
        }
      };
      
      const timer = setTimeout(setup, 2000);
      return () => clearTimeout(timer);
    }
    
    if (!user) {
      setupComplete.current = false;
    }
  }, [user, profile]);

  // Limpiar al cerrar sesión
  useEffect(() => {
    if (!user) {
      limpiarFcmAlLogout();
    }
  }, [user, limpiarFcmAlLogout]);

  return null;
}