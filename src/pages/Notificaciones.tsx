
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notification, User } from "@/types/notification";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, Bell, Check, Mail, User as UserIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const Notificaciones = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // State for notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  
  // State for recipients
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // State for filters
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Redirect if not admin or secretaria
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'secretaria') {
      navigate('/');
    }
  }, [profile, navigate]);
  
  // Load departments
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order('name');
      
      if (error) {
        console.error("Error fetching departments:", error);
        return;
      }
      
      setDepartments(data || []);
    };
    
    fetchDepartments();
  }, []);
  
  // Load classes
  useEffect(() => {
    const fetchClasses = async () => {
      if (departmentFilter) {
        const { data, error } = await supabase
          .from("departments")
          .select("classes")
          .eq("id", departmentFilter)
          .single();
        
        if (error) {
          console.error("Error fetching classes:", error);
          return;
        }
        
        setClasses(data?.classes || []);
      } else {
        setClasses([]);
      }
    };
    
    fetchClasses();
  }, [departmentFilter]);
  
  // Load users
  useEffect(() => {
    const fetchUsers = async () => {
      let query = supabase
        .from("profiles")
        .select(`
          id,
          first_name,
          last_name,
          role,
          departments,
          department_id,
          assigned_class,
          email
        `)
        .neq('id', profile?.id || ''); // exclude current user
      
      if (departmentFilter) {
        query = query.eq('department_id', departmentFilter);
      }
      
      if (classFilter) {
        query = query.eq('assigned_class', classFilter);
      }
      
      if (nameFilter) {
        query = query.or(`first_name.ilike.%${nameFilter}%,last_name.ilike.%${nameFilter}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching users:", error);
        return;
      }
      
      setUsers(data || []);
      setSelectedUsers([]);
      setSelectAll(false);
    };
    
    if (profile) {
      fetchUsers();
    }
  }, [profile, departmentFilter, classFilter, nameFilter]);
  
  // Load notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!profile?.id) return;
      
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          sender:profiles!sender_id(first_name, last_name),
          recipients:notification_recipients!inner(recipient_id, read, read_at)
        `)
        .eq('recipients.recipient_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }
      
      // Map the data to our Notification interface
      const mappedNotifications = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        sender_id: item.sender_id,
        sender_name: `${item.sender.first_name} ${item.sender.last_name}`,
        created_at: item.created_at,
        updated_at: item.updated_at,
        read: item.recipients[0].read
      }));
      
      setNotifications(mappedNotifications);
    };
    
    if (profile) {
      fetchNotifications();
    }
  }, [profile]);
  
  const handleSelectAll = () => {
    const newValue = !selectAll;
    setSelectAll(newValue);
    
    if (newValue) {
      setSelectedUsers(users.map(user => user.id));
    } else {
      setSelectedUsers([]);
    }
  };
  
  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev => {
      const isSelected = prev.includes(userId);
      
      if (isSelected) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };
  
  const handleSendNotification = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "El título de la notificación no puede estar vacío",
        variant: "destructive"
      });
      return;
    }
    
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "El mensaje de la notificación no puede estar vacío",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Debe seleccionar al menos un destinatario",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Insert notification
      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .insert({
          title,
          message,
          sender_id: profile?.id
        })
        .select("id")
        .single();
      
      if (notificationError) {
        throw notificationError;
      }
      
      // Insert notification recipients
      const recipients = selectedUsers.map(userId => ({
        notification_id: notificationData.id,
        recipient_id: userId
      }));
      
      const { error: recipientsError } = await supabase
        .from("notification_recipients")
        .insert(recipients);
      
      if (recipientsError) {
        throw recipientsError;
      }
      
      // Success!
      toast({
        title: "Notificación enviada",
        description: `Se ha enviado la notificación a ${selectedUsers.length} ${selectedUsers.length === 1 ? 'usuario' : 'usuarios'}.`
      });
      
      // Reset form
      setTitle("");
      setMessage("");
      setSelectedUsers([]);
      setSelectAll(false);
      
    } catch (error) {
      console.error("Error sending notification:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la notificación",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Find the notification in our state
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification || notification.read) {
        return; // Already read or not found
      }
      
      // Update the record in the database
      const { error } = await supabase
        .from("notification_recipients")
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq("notification_id", notificationId)
        .eq("recipient_id", profile?.id);
      
      if (error) {
        throw error;
      }
      
      // Update our state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({
        title: "Error",
        description: "No se pudo marcar la notificación como leída",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
          <CardDescription>
            Gestione las notificaciones para los usuarios del sistema
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="send">
        <TabsList className="mb-4">
          <TabsTrigger value="send">Enviar Notificación</TabsTrigger>
          <TabsTrigger value="inbox">Bandeja de Entrada</TabsTrigger>
        </TabsList>
        
        <TabsContent value="send">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Redactar Notificación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    Título
                  </label>
                  <Input
                    id="title"
                    placeholder="Título de la notificación"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1">
                    Mensaje
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Escriba el mensaje de la notificación aquí..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={6}
                  />
                </div>
                
                <Button 
                  onClick={handleSendNotification} 
                  disabled={isLoading || selectedUsers.length === 0 || !title || !message}
                  className="w-full mt-4"
                >
                  {isLoading ? 'Enviando...' : 'Enviar Notificación'}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Destinatarios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium mb-1">
                      Filtrar por Departamento
                    </label>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los departamentos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos los departamentos</SelectItem>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {departmentFilter && classes.length > 0 && (
                    <div>
                      <label htmlFor="class" className="block text-sm font-medium mb-1">
                        Filtrar por Clase
                      </label>
                      <Select value={classFilter} onValueChange={setClassFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas las clases" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todas las clases</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              {cls}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div>
                    <label htmlFor="nameFilter" className="block text-sm font-medium mb-1">
                      Buscar por Nombre
                    </label>
                    <Input
                      id="nameFilter"
                      placeholder="Nombre o apellido"
                      value={nameFilter}
                      onChange={e => setNameFilter(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Checkbox 
                      id="selectAll" 
                      checked={selectAll} 
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="selectAll" className="text-sm font-medium">
                      Seleccionar Todos ({users.length})
                    </label>
                  </div>
                  
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {users.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No hay usuarios disponibles con los filtros seleccionados
                        </div>
                      ) : (
                        users.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
                            <Checkbox 
                              id={`user-${user.id}`} 
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => handleUserSelect(user.id)}
                            />
                            <label 
                              htmlFor={`user-${user.id}`} 
                              className="flex-1 flex items-center space-x-2 cursor-pointer"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  {user.first_name?.[0]}{user.last_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 truncate">
                                <div className="font-medium">{user.first_name} {user.last_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {user.role} {user.assigned_class ? `- ${user.assigned_class}` : ''}
                                </div>
                              </div>
                              <Badge variant="outline" className="ml-auto">
                                {departments.find(d => d.id === user.department_id)?.name || 'Sin departamento'}
                              </Badge>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  
                  <div className="mt-4 text-sm text-muted-foreground">
                    {selectedUsers.length} usuarios seleccionados
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle>Bandeja de Entrada</CardTitle>
              <CardDescription>
                Notificaciones que ha recibido
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <h3 className="text-lg font-medium">No tiene notificaciones</h3>
                  <p className="text-sm text-muted-foreground">
                    Las notificaciones que reciba aparecerán aquí
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`p-4 border rounded-lg ${notification.read ? 'bg-background' : 'bg-muted/50'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center">
                            <Mail className={`mr-2 h-5 w-5 ${notification.read ? 'text-muted-foreground' : 'text-primary'}`} />
                            <h3 className="font-semibold text-lg">{notification.title}</h3>
                          </div>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="h-8 px-2"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              <span className="text-xs">Marcar como leída</span>
                            </Button>
                          )}
                        </div>
                        
                        <div className="text-sm mb-3 whitespace-pre-line">
                          {notification.message}
                        </div>
                        
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <UserIcon className="h-3 w-3 mr-1" />
                            <span>De: {notification.sender_name}</span>
                          </div>
                          <div>
                            {format(new Date(notification.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Notificaciones;
