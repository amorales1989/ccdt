import { useState } from "react";
import { Bell, BellRing, CheckCheck, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMyNotifications, markNotificationsRead, UserNotification } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
// @ts-expect-error — hook JS sin tipos
import { useFcm } from "@/hooks/useFcm";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { configurarFcmPostLogin } = useFcm();

  const pushSupported = typeof window !== 'undefined' && 'Notification' in window;
  const [permission, setPermission] = useState<NotificationPermission | null>(
    pushSupported ? Notification.permission : null
  );
  const [enabling, setEnabling] = useState(false);

  const handleEnablePush = async () => {
    setEnabling(true);
    try {
      // Pide el permiso del navegador y registra el token FCM (mismos params que NotificationHandler)
      await configurarFcmPostLogin({ empresaId: 1, localId: 1 });
    } finally {
      setPermission(Notification.permission);
      setEnabling(false);
    }
  };

  const { data } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: getMyNotifications,
    enabled: !!user,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const notifications = data?.data || [];
  const unread = data?.unread || 0;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] });

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead();
      refresh();
    } catch { /* silencioso: se reintenta en el próximo refetch */ }
  };

  const handleClickItem = async (n: UserNotification) => {
    if (!n.read_at) {
      try {
        await markNotificationsRead([n.id]);
        refresh();
      } catch { /* noop */ }
    }
    if (n.link) {
      if (n.link.startsWith('http')) {
        window.open(n.link, '_blank');
      } else {
        navigate(n.link);
      }
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-purple-50 dark:hover:bg-purple-900/20">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold shadow-sm">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0 rounded-2xl shadow-xl border-slate-100 dark:border-slate-800">
        {pushSupported && permission === 'default' && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/60 dark:bg-purple-900/10">
            <div className="flex items-start gap-2">
              <BellRing className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">¿Querés recibir notificaciones en este dispositivo?</p>
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  disabled={enabling}
                  className="mt-2 h-7 rounded-lg text-[11px] font-black uppercase tracking-wide"
                >
                  {enabling && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Activar notificaciones
                </Button>
              </div>
            </div>
          </div>
        )}
        {pushSupported && permission === 'denied' && (
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-900/10">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Las notificaciones están bloqueadas. Habilitalas desde la configuración del navegador para este sitio.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100">Notificaciones</p>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas leídas
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">No tenés notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <ul className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {notifications.map(n => (
                <li
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!n.read_at ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-primary" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{n.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-3 whitespace-pre-line">{n.body}</p>
                      <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase tracking-wide">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
