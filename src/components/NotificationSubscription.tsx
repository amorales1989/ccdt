
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { BellRing, BellOff, AlertTriangle } from "lucide-react";

export function NotificationSubscription() {
  const { 
    isSupported, 
    isSubscribed, 
    isSubscribing,
    subscribeToNotifications, 
    unsubscribeFromNotifications 
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="p-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <p className="text-amber-800 dark:text-amber-300">
            Tu navegador no soporta notificaciones push.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium dark:text-white">Notificaciones Push</h3>
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            Recibe notificaciones cuando se crean nuevos eventos
          </p>
        </div>
        {isSubscribed ? (
          <Button 
            variant="outline" 
            className="border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-900/30"
            onClick={unsubscribeFromNotifications}
          >
            <BellOff className="mr-2 h-4 w-4 text-red-500" />
            Desactivar
          </Button>
        ) : (
          <Button 
            variant="outline"
            className="border-green-200 hover:bg-green-50 hover:text-green-600 dark:border-green-800 dark:hover:bg-green-900/30" 
            onClick={subscribeToNotifications}
            disabled={isSubscribing}
          >
            <BellRing className="mr-2 h-4 w-4 text-green-500" />
            {isSubscribing ? "Activando..." : "Activar"}
          </Button>
        )}
      </div>
      {isSubscribed && (
        <Card className="p-4 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-green-500" />
            <p className="text-green-800 dark:text-green-300">
              Las notificaciones están activadas. Recibirás alertas cuando se creen nuevos eventos.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
