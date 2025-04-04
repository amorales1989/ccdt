
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getDepartments } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

type User = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  departments: string[] | null;
  assigned_class: string | null;
  selected: boolean;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  sender_id: string;
  sender_name?: string;
  created_at: string;
  read: boolean;
};

const Notificaciones = () => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Redirect if not admin or secretaria
  if (profile?.role !== 'admin' && profile?.role !== 'secretaria') {
    navigate('/');
    return null;
  }

  // Get departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
  });

  // Get unique classes from departments
  const classes = departments
    .flatMap(dept => dept.classes || [])
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

  // Fetch users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*');

        if (error) {
          throw error;
        }

        const formattedUsers = data.map(u => ({
          ...u,
          selected: false
        }));

        setUsers(formattedUsers);
        setFilteredUsers(formattedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los usuarios',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [toast]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      
      setNotificationsLoading(true);
      try {
        // Get notifications sent by this user
        const { data: sentNotifications, error: sentError } = await supabase
          .from('notifications')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        if (sentError) throw sentError;

        // Format the notifications
        const notificationsWithDetails = sentNotifications.map(notification => ({
          ...notification,
          sender_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          read: true // Sender always sees as read
        }));

        setNotifications(notificationsWithDetails);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las notificaciones',
          variant: 'destructive'
        });
      } finally {
        setNotificationsLoading(false);
      }
    };

    fetchNotifications();
  }, [user, profile, toast]);

  // Apply filters
  useEffect(() => {
    let filtered = [...users];

    if (selectedDepartment) {
      filtered = filtered.filter(user => 
        user.departments?.includes(selectedDepartment)
      );
    }

    if (selectedClass) {
      filtered = filtered.filter(user => 
        user.assigned_class === selectedClass
      );
    }

    if (searchName) {
      const search = searchName.toLowerCase();
      filtered = filtered.filter(user => 
        (user.first_name?.toLowerCase().includes(search) || 
         user.last_name?.toLowerCase().includes(search))
      );
    }

    setFilteredUsers(filtered);
  }, [selectedDepartment, selectedClass, searchName, users]);

  // Handle select all
  useEffect(() => {
    if (selectAll) {
      setFilteredUsers(prev => prev.map(user => ({ ...user, selected: true })));
    } else {
      setFilteredUsers(prev => prev.map(user => ({ ...user, selected: false })));
    }
  }, [selectAll]);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setFilteredUsers(prev => 
      prev.map(user => 
        user.id === userId ? { ...user, selected: !user.selected } : user
      )
    );
    
    // Also update in the main users array
    setUsers(prev => 
      prev.map(user => 
        user.id === userId ? { ...user, selected: !user.selected } : user
      )
    );
  };

  // Reset form
  const resetForm = () => {
    setTitle("");
    setMessage("");
    setSelectedDepartment("");
    setSelectedClass("");
    setSearchName("");
    setUsers(prev => prev.map(user => ({ ...user, selected: false })));
    setFilteredUsers(prev => prev.map(user => ({ ...user, selected: false })));
    setSelectAll(false);
  };

  // Send notification
  const sendNotification = async () => {
    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un título para la notificación',
        variant: 'destructive'
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa un mensaje para la notificación',
        variant: 'destructive'
      });
      return;
    }

    const selectedUsers = filteredUsers.filter(user => user.selected);
    if (selectedUsers.length === 0) {
      toast({
        title: 'Error',
        description: 'Por favor selecciona al menos un destinatario',
        variant: 'destructive'
      });
      return;
    }

    setSendLoading(true);
    try {
      // First, create the notification
      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          title,
          message,
          sender_id: user?.id
        })
        .select()
        .single();

      if (notificationError) throw notificationError;

      // Then create notification recipients
      const recipients = selectedUsers.map(user => ({
        notification_id: notification.id,
        recipient_id: user.id
      }));

      const { error: recipientsError } = await supabase
        .from('notification_recipients')
        .insert(recipients);

      if (recipientsError) throw recipientsError;

      toast({
        title: 'Notificación enviada',
        description: `Enviada a ${selectedUsers.length} destinatario(s)`
      });

      // Add to local notifications list
      setNotifications(prev => [
        {
          ...notification,
          sender_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          read: true
        },
        ...prev
      ]);

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar la notificación',
        variant: 'destructive'
      });
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gestión de Notificaciones</CardTitle>
          <CardDescription>
            Crea y envía notificaciones a los usuarios del sistema
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="crear">
        <TabsList className="mb-4">
          <TabsTrigger value="crear">Crear Notificación</TabsTrigger>
          <TabsTrigger value="historial">Historial de Notificaciones</TabsTrigger>
        </TabsList>
        
        <TabsContent value="crear">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Nueva Notificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input 
                    id="title" 
                    placeholder="Título de la notificación" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Escribe el contenido de la notificación aquí..." 
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={resetForm}>
                    Limpiar
                  </Button>
                  <Button 
                    onClick={sendNotification} 
                    disabled={sendLoading}
                  >
                    {sendLoading ? "Enviando..." : "Enviar Notificación"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Destinatarios</CardTitle>
                <CardDescription>
                  Selecciona los usuarios que recibirán esta notificación
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Filtrar por Departamento</Label>
                  <Select 
                    value={selectedDepartment} 
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Todos los departamentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los departamentos</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.name || ''}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="class">Filtrar por Clase</Label>
                  <Select 
                    value={selectedClass} 
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger id="class">
                      <SelectValue placeholder="Todas las clases" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas las clases</SelectItem>
                      {classes.map(className => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search">Buscar por Nombre</Label>
                  <Input 
                    id="search" 
                    placeholder="Nombre o apellido" 
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>

                <Separator className="my-2" />

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="select-all" 
                    checked={selectAll}
                    onCheckedChange={(checked) => {
                      setSelectAll(checked === true);
                    }}
                  />
                  <Label htmlFor="select-all">Seleccionar todos</Label>
                </div>

                <ScrollArea className="h-64 rounded-md border">
                  <div className="p-4 space-y-2">
                    {loading ? (
                      <p className="text-center text-muted-foreground">Cargando usuarios...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-center text-muted-foreground">No se encontraron usuarios con los filtros aplicados</p>
                    ) : (
                      filteredUsers.map(user => (
                        <div key={user.id} className="flex items-center space-x-2 py-2 border-b last:border-0">
                          <Checkbox 
                            id={`user-${user.id}`} 
                            checked={user.selected}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                          />
                          <div>
                            <Label htmlFor={`user-${user.id}`} className="text-sm font-medium">
                              {user.first_name} {user.last_name}
                            </Label>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                              {user.departments && user.departments.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {user.departments[0]}
                                </Badge>
                              )}
                              {user.assigned_class && (
                                <Badge variant="outline" className="text-xs">
                                  Clase: {user.assigned_class}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                
                <div className="text-sm text-muted-foreground">
                  {filteredUsers.filter(u => u.selected).length} usuario(s) seleccionado(s) de {filteredUsers.length} filtrado(s)
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Notificaciones Enviadas</CardTitle>
              <CardDescription>
                Visualiza las notificaciones que has enviado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationsLoading ? (
                <p className="text-center text-muted-foreground py-4">Cargando notificaciones...</p>
              ) : notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No has enviado ninguna notificación</p>
              ) : (
                <div className="space-y-4">
                  {notifications.map(notification => (
                    <Card key={notification.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-lg">{notification.title}</CardTitle>
                          <div className="text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notificaciones;
