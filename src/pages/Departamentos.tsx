
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department, DepartmentType } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash, Plus, X } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Departamentos = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState<DepartmentType>("escuelita_central");
  const [description, setDescription] = useState("");
  const [newClass, setNewClass] = useState("");
  const [classes, setClasses] = useState<string[]>([]);

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
        description: "El departamento ha sido creado exitosamente",
        variant: "success"
      });
      setIsCreating(false);
      setName("escuelita_central");
      setDescription("");
      setClasses([]);
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
    mutationFn: async ({ id, description, classes }: { id: string; description?: string; classes?: string[] }) => {
      return updateDepartment(id, { description, classes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({
        title: "Departamento actualizado",
        description: "El departamento ha sido actualizado exitosamente"
      });
      setIsEditing(false);
      setSelectedDepartment(null);
      setDescription("");
      setClasses([]);
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

  const handleAddClass = () => {
    if (newClass.trim() && !classes.includes(newClass.trim())) {
      setClasses([...classes, newClass.trim()]);
      setNewClass("");
    }
  };

  const handleRemoveClass = (classToRemove: string) => {
    setClasses(classes.filter(c => c !== classToRemove));
  };

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
                <Plus className="h-4 w-4" />
                {!isMobile && <span className="ml-2">Nuevo Departamento</span>}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Departamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Select 
                    value={name} 
                    onValueChange={(value) => setName(value as DepartmentType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="escuelita_central">Escuelita Central</SelectItem>
                      <SelectItem value="pre_adolescentes">Pre Adolescentes</SelectItem>
                      <SelectItem value="adolescentes">Adolescentes</SelectItem>
                      <SelectItem value="jovenes">Jóvenes</SelectItem>
                      <SelectItem value="jovenes_adultos">Jóvenes Adultos</SelectItem>
                      <SelectItem value="adultos">Adultos</SelectItem>
                    </SelectContent>
                  </Select>
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
                <div>
                  <Label htmlFor="classes">Clases</Label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      id="classes"
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      placeholder="Nombre de la clase"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddClass();
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      onClick={handleAddClass}
                      disabled={!newClass.trim()}
                    >
                      Agregar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {classes.map((className, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-white"
                      >
                        <span>{className}</span>
                        <button
                          onClick={() => handleRemoveClass(className)}
                          className="text-white/80 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (name) {
                      createDepartmentMutation.mutate({
                        name: name,
                        description: description.trim() || undefined,
                        classes
                      });
                    }
                  }}
                  disabled={!name}
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
                  <div className="space-y-2">
                    <h3 className="font-semibold">{department.name}</h3>
                    <p className="text-sm text-muted-foreground">{department.description || "Sin descripción"}</p>
                    {department.classes && department.classes.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {department.classes.map((className, index) => (
                          <span
                            key={index}
                            className="bg-secondary px-2 py-1 rounded text-sm text-white"
                          >
                            {className}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isEditing && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditing(false);
                        setSelectedDepartment(null);
                        setDescription("");
                        setClasses([]);
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
                            setClasses(department.classes || []);
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
                            <p className="text-sm text-muted-foreground">{department.name}</p>
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
                          <div>
                            <Label htmlFor="classes">Clases</Label>
                            <div className="flex gap-2 mb-2">
                              <Input
                                id="classes"
                                value={newClass}
                                onChange={(e) => setNewClass(e.target.value)}
                                placeholder="Nombre de la clase"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddClass();
                                  }
                                }}
                              />
                              <Button 
                                type="button" 
                                onClick={handleAddClass}
                                disabled={!newClass.trim()}
                              >
                                Agregar
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {classes.map((className, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-white"
                                >
                                  <span>{className}</span>
                                  <button
                                    onClick={() => handleRemoveClass(className)}
                                    className="text-white/80 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (selectedDepartment) {
                                updateDepartmentMutation.mutate({
                                  id: selectedDepartment.id,
                                  description,
                                  classes
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
