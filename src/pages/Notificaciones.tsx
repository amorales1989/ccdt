
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getNotifications, markNotificationAsRead } from "@/lib/api";
import { Notification } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellDot } from "lucide-react";
import { format } from "date-fns";

const Notificaciones = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNotification, setOpenNotification] = useState<Notification | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const notificationsData = await getNotifications(user?.id || "");
      setNotifications(notificationsData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las notificaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNotification = async (notification: Notification) => {
    setOpenNotification(notification);
    
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id, user?.id || "");
        // Update the notification in the local state
        setNotifications(prevNotifications => 
          prevNotifications.map(n => 
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Cargando notificaciones...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notificaciones</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchNotifications}
          >
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground">No hay notificaciones</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow 
                    key={notification.id}
                    className={`cursor-pointer hover:bg-muted/50 ${notification.is_read ? '' : 'font-medium'}`}
                    onClick={() => handleOpenNotification(notification)}
                  >
                    <TableCell>
                      {notification.is_read ? (
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <BellDot className="h-4 w-4 text-primary" />
                      )}
                    </TableCell>
                    <TableCell>{notification.title}</TableCell>
                    <TableCell>{notification.department || (notification.send_to_all ? "Todos" : "-")}</TableCell>
                    <TableCell>{notification.assigned_class || (notification.send_to_all ? "Todas" : "-")}</TableCell>
                    <TableCell>{formatDate(notification.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!openNotification} onOpenChange={() => setOpenNotification(null)}>
        {openNotification && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{openNotification.title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {openNotification.department || (openNotification.send_to_all ? "Todos los departamentos" : "-")} • 
                {openNotification.assigned_class || (openNotification.send_to_all ? " Todas las clases" : " -")} • 
                {formatDate(openNotification.created_at)}
              </DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-wrap">{openNotification.content}</div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Notificaciones;
