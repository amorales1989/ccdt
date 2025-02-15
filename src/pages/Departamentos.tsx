
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment } from "@/lib/api";
import { Department } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const Departamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState("");

  // Redirect if not admin or secretaria
  if (profile?.role !== 'admin' && profile?.role !== 'secretaria') {
    navigate('/');
    return null;
  }

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      return updateDepartment(id, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: "Departamento actualizado",
        description: "La descripción del departamento ha sido actualizada exitosamente"
      });
      setIsEditing(false);
      setSelectedDepartment(null);
      setDescription("");
    },
    onError: (error) => {
      console.error("Error updating department:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el departamento",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Departamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {departments.map((department) => (
              <Card key={department.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold capitalize">{department.name}</h3>
                    <p className="text-sm text-muted-foreground">{department.description || "Sin descripción"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isEditing && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditing(false);
                        setSelectedDepartment(null);
                        setDescription("");
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedDepartment(department);
                            setIsEditing(true);
                            setDescription(department.description || "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Departamento</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name">Nombre</Label>
                            <p className="text-sm text-muted-foreground capitalize">{department.name}</p>
                          </div>
                          <div>
                            <Label htmlFor="description">Descripción</Label>
                            <Textarea
                              id="description"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Ingrese una descripción para el departamento"
                              className="min-h-[100px]"
                            />
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (selectedDepartment) {
                                updateDepartmentMutation.mutate({
                                  id: selectedDepartment.id,
                                  description
                                });
                              }
                            }}
                          >
                            Guardar Cambios
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Departamentos;
