
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';

const PUBLIC_VAPID_KEY = 'BNbKwE2klZ-BimOBGDuW-b6yP3qRuJJHNeEcnMLip9UQJkIYxwKn_UsFHHxDCBwNKJKJVdQiSnTBGiOzHo2mXNQ';

export function usePushNotifications() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  // Check if service workers and push messaging are supported
  const isPushSupported = () => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  };

  // Register the service worker
  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  };

  // Subscribe to push notifications
  const subscribeToNotifications = async () => {
    if (!isPushSupported()) {
      toast({
        title: "No soportado",
        description: "Tu navegador no soporta notificaciones push.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubscribing(true);
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Permiso denegado",
          description: "Necesitamos permiso para enviar notificaciones.",
          variant: "destructive"
        });
        setIsSubscribing(false);
        return;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        toast({
          title: "Error",
          description: "No se pudo registrar el service worker.",
          variant: "destructive"
        });
        setIsSubscribing(false);
        return;
      }

      // Subscribe to push notifications
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        setSubscription(existingSubscription);
        setIsSubscribed(true);
        await saveSubscription(existingSubscription);
        setIsSubscribing(false);
        return existingSubscription;
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });
      
      setSubscription(newSubscription);
      setIsSubscribed(true);
      
      // Save the subscription to the database
      await saveSubscription(newSubscription);
      
      toast({
        title: "¡Suscrito!",
        description: "Recibirás notificaciones cuando se creen nuevos eventos.",
        variant: "success"
      });
      
      return newSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        title: "Error",
        description: "No se pudo suscribir a las notificaciones.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsSubscribing(false);
    }
  };

  // Save subscription to database
  const saveSubscription = async (subscription: PushSubscription) => {
    if (!profile?.id) return;

    const subscriptionJSON = subscription.toJSON();
    
    try {
      // Using the raw query method instead of the typed client
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: profile.id,
          subscription: subscriptionJSON,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
        
      if (error) {
        console.error('Error saving subscription:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving push subscription:', error);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribeFromNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Remove from database if user is logged in
        if (profile?.id) {
          // Using the raw query method
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', profile.id);
        }
        
        setSubscription(null);
        setIsSubscribed(false);
        
        toast({
          title: "Desuscrito",
          description: "Ya no recibirás notificaciones de eventos.",
        });
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la suscripción.",
        variant: "destructive"
      });
    }
  };

  // Check subscription status on mount
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isPushSupported()) return;
      
      try {
        const registration = await navigator.serviceWorker.ready;
        const currentSubscription = await registration.pushManager.getSubscription();
        
        if (currentSubscription) {
          setSubscription(currentSubscription);
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };
    
    checkSubscription();
  }, []);

  // Utility function to convert base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };

  return {
    isSupported: isPushSupported(),
    isSubscribed,
    isSubscribing,
    subscribeToNotifications,
    unsubscribeFromNotifications
  };
}
