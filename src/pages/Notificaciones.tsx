
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createNotification, getNotifications, getDepartments, deleteNotification } from "@/lib/api";
import { Notification, Department } from "@/types/database";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Notificaciones = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [assignedClass, setAssignedClass] = useState<string>("");
  const [sendToAll, setSendToAll] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Redirect if not admin or secretaria
    if (profile && profile.role !== "admin" && profile.role !== "secretaria") {
      navigate("/");
      return;
    }

    fetchNotifications();
    fetchDepartments();
  }, [profile, navigate]);

  useEffect(() => {
    // Update available classes when department changes
    if (departmentId) {
      const selectedDept = departments.find(dept => dept.id === departmentId);
      setAvailableClasses(selectedDept?.classes || []);
      setAssignedClass(""); // Reset selected class
    } else {
      setAvailableClasses([]);
      setAssignedClass("");
    }
  }, [departmentId, departments]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
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

  const fetchDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los departamentos",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !content) {
      toast({
        title: "Error",
        description: "Por favor completa el título y el contenido",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const newNotification = {
        title,
        content,
        department_id: sendToAll ? undefined : departmentId || undefined,
        assigned_class: sendToAll ? undefined : assignedClass || undefined,
        send_to_all: sendToAll
      };

      await createNotification(newNotification);
      
      // Reset form
      setTitle("");
      setContent("");
      setDepartmentId("");
      setAssignedClass("");
      setSendToAll(false);
      
      // Reload notifications
      await fetchNotifications();
      
      toast({
        title: "Éxito",
        description: "Notificación creada correctamente",
      });
    } catch (error) {
      console.error("Error creating notification:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la notificación",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      toast({
        title: "Éxito",
        description: "Notificación eliminada correctamente",
      });
      // Reload notifications
      await fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la notificación",
        variant: "destructive",
      });
    }
  };

  // If profile is still loading, return null
  if (!profile) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear Notificación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
                Título
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la notificación"
                required
              />
            </div>
            
            <div>
              <label htmlFor="content" className="block text-sm font-medium mb-1">
                Contenido
              </label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Contenido de la notificación"
                required
                rows={4}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendToAll"
                checked={sendToAll}
                onCheckedChange={(checked) => setSendToAll(checked as boolean)}
              />
              <label
                htmlFor="sendToAll"
                className="text-sm font-medium leading-none cursor-pointer"
              >
                Enviar a todos
              </label>
            </div>

            {!sendToAll && (
              <>
                <div>
                  <label htmlFor="department" className="block text-sm font-medium mb-1">
                    Departamento
                  </label>
                  <Select 
                    value={departmentId} 
                    onValueChange={setDepartmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {departmentId && availableClasses.length > 0 && (
                  <div>
                    <label htmlFor="class" className="block text-sm font-medium mb-1">
                      Clase
                    </label>
                    <Select 
                      value={assignedClass} 
                      onValueChange={setAssignedClass}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar clase" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Notificación"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <Alert>
              <AlertDescription>
                No hay notificaciones disponibles.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Clase</TableHead>
                    <TableHead>Todos</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>{notification.title}</TableCell>
                      <TableCell>
                        {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {notification.department_id ? (
                          departments.find(d => d.id === notification.department_id)?.name || "-"
                        ) : "-"}
                      </TableCell>
                      <TableCell>{notification.assigned_class || "-"}</TableCell>
                      <TableCell>{notification.send_to_all ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Eliminar Notificación</DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                              ¿Estás seguro de que deseas eliminar la notificación "{notification.title}"?
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancelar</Button>
                              </DialogClose>
                              <Button 
                                variant="destructive" 
                                onClick={() => handleDelete(notification.id)}
                              >
                                Eliminar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notificaciones;
