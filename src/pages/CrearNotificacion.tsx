
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getDepartments, createNotification } from "@/lib/api";
import { Department } from "@/types/database";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const CrearNotificacion = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [assignedClass, setAssignedClass] = useState<string>("");
  const [sendToAll, setSendToAll] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = profile?.role === "admin" || profile?.role === "secretaria";

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }

    const fetchDepartments = async () => {
      try {
        const deps = await getDepartments();
        setDepartments(deps);
      } catch (error) {
        console.error("Error loading departments:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los departamentos",
          variant: "destructive",
        });
      }
    };

    fetchDepartments();
  }, [isAdmin, navigate, toast]);

  // Update available classes when department changes
  useEffect(() => {
    if (departmentId) {
      const selectedDept = departments.find(d => d.id === departmentId);
      setClasses(selectedDept?.classes || []);
      setAssignedClass(""); // Reset selected class
    } else {
      setClasses([]);
    }
  }, [departmentId, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "El título es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "El contenido es obligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!sendToAll && !departmentId) {
      toast({
        title: "Error",
        description: "Debe seleccionar un departamento o enviar a todos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await createNotification({
        title,
        content,
        department_id: sendToAll ? undefined : departmentId,
        assigned_class: sendToAll ? undefined : assignedClass,
        send_to_all: sendToAll,
      });

      toast({
        title: "Éxito",
        description: "Notificación creada correctamente",
        variant: "success",
      });

      // Reset form
      setTitle("");
      setContent("");
      setDepartmentId("");
      setAssignedClass("");
      setSendToAll(false);

      // Navigate to notifications page
      navigate("/notificaciones");
    } catch (error) {
      console.error("Error creating notification:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la notificación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear Notificación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la notificación"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Contenido</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escriba el contenido de la notificación"
                rows={6}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="sendToAll" 
                checked={sendToAll} 
                onCheckedChange={(checked) => {
                  const isChecked = Boolean(checked);
                  setSendToAll(isChecked);
                  if (isChecked) {
                    setDepartmentId("");
                    setAssignedClass("");
                  }
                }}
              />
              <Label htmlFor="sendToAll">Enviar a todos los departamentos y clases</Label>
            </div>

            {!sendToAll && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Select
                    value={departmentId}
                    onValueChange={setDepartmentId}
                    disabled={sendToAll}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione un departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {departmentId && classes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="class">Clase</Label>
                    <Select
                      value={assignedClass}
                      onValueChange={setAssignedClass}
                      disabled={sendToAll || !departmentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las clases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas las clases</SelectItem>
                        {classes.map((className) => (
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creando..." : "Crear Notificación"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrearNotificacion;
