
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getNotifications, markNotificationAsRead } from '@/lib/api';
import { Notification } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const Notificaciones = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const data = await getNotifications(user.id);
        setNotifications(data);
        setFilteredNotifications(data);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las notificaciones',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, [user, toast]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNotifications(notifications);
      return;
    }

    const filtered = notifications.filter(
      notification => 
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setFilteredNotifications(filtered);
  }, [searchQuery, notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) return;
    
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id, user.id);
        
        // Update the local state to reflect the notification has been read
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
        
        // Also update the filtered list
        setFilteredNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }
    
    // We could open a dialog or navigate to a detail page here
    // For now, we'll just mark it as read
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div>Cargando notificaciones...</div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          
          {user?.role === 'admin' || user?.role === 'secretaria' ? (
            <Button onClick={() => navigate('/crear-notificacion')}>
              Crear notificación
            </Button>
          ) : null}
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notificaciones..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No hay notificaciones para mostrar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredNotifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={notification.is_read ? '' : 'border-primary'}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{notification.title}</CardTitle>
                    {!notification.is_read && (
                      <Badge variant="default">Nueva</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm')}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <p className="whitespace-pre-line">{notification.content}</p>
                </CardContent>
                
                <CardFooter>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {notification.department && (
                      <div>Departamento: {notification.department.replace(/_/g, ' ')}</div>
                    )}
                    {notification.assigned_class && (
                      <>
                        <div className="mx-1">•</div>
                        <div>Clase: {notification.assigned_class}</div>
                      </>
                    )}
                    {notification.send_to_all && (
                      <div>{notification.department || notification.assigned_class ? ' • ' : ''}Para todos</div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notificaciones;
