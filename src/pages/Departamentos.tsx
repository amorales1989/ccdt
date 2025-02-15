
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Departamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState("");
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

  const createDepartmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: "Departamento creado",
        description: "El departamento ha sido creado exitosamente"
      });
      setIsCreating(false);
      setName("");
      setDescription("");
    },
    onError: (error) => {
      console.error("Error creating department:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el departamento",
        variant: "destructive"
      });
    }
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

  const deleteDepartmentMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: "Departamento eliminado",
        description: "El departamento ha sido eliminado exitosamente"
      });
      setIsDeleting(false);
      setSelectedDepartment(null);
    },
    onError: (error) => {
      console.error("Error deleting department:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el departamento",
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Gestión de Departamentos</CardTitle>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Departamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Departamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ingrese el nombre del departamento"
                  />
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
                    if (name.trim()) {
                      createDepartmentMutation.mutate({
                        name: name.trim(),
                        description: description.trim() || undefined
                      });
                    }
                  }}
                  disabled={!name.trim()}
                >
                  Crear Departamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                    <AlertDialog open={isDeleting && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsDeleting(false);
                        setSelectedDepartment(null);
                      }
                    }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDepartment(department);
                          setIsDeleting(true);
                        }}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el departamento
                            <span className="font-semibold"> {department.name}</span>.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => {
                            setIsDeleting(false);
                            setSelectedDepartment(null);
                          }}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (selectedDepartment) {
                                deleteDepartmentMutation.mutate(selectedDepartment.id);
                              }
                            }}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
