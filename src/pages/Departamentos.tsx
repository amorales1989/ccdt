
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department, DepartmentType } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Pencil, Trash, Plus, X } from "lucide-react";
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
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState("");
  const [newClass, setNewClass] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingName, setEditingName] = useState<string>("");

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
    mutationFn: async ({ id, name, description, classes }: { id: string; name?: string; description?: string; classes?: string[] }) => {
      return updateDepartment(id, { name: name as DepartmentType, description, classes });
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
        description: "El departamento ha sido eliminado exitosamente y los estudiantes asociados han sido desvinculados"
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

  const handleEditDepartment = (department: Department) => {
    setEditingDepartment({
      ...department,
      name: department.name as DepartmentType,
      description: department.description || "",
      classes: [...(department.classes || [])],
    });
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
              <Layers className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Departamentos</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Administra las áreas y clases de tu organización.
              </p>
            </div>
          </div>

          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl whitespace-nowrap">
                <Plus className="h-5 w-5 mr-2" />
                <span>Nuevo Departamento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
              <DialogHeader className="relative z-10">
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                    <Plus className="h-5 w-5" />
                  </div>
                  Crear Departamento
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del departamento"
                    className="w-full"
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
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl h-12 mt-4"
                  onClick={() => {
                    if (name) {
                      createDepartmentMutation.mutate({
                        name: name as DepartmentType,
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
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((department) => (
          <Card key={department.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-2xl group-hover:bg-purple-400/10 transition-colors pointer-events-none" />

            <div className="flex flex-col h-full relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold capitalize text-slate-800 dark:text-slate-100">{department.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{department.description || "Sin descripción"}</p>
                </div>
              </div>

              <div className="flex-grow mt-2 mb-6">
                {department.classes && department.classes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {department.classes.map((className, index) => (
                      <span
                        key={index}
                        className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-medium"
                      >
                        {className}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic opacity-70">No hay clases configuradas</p>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <Dialog open={isEditing && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                  if (!open) {
                    setIsEditing(false);
                    setSelectedDepartment(null);
                    setDescription("");
                    setClasses([]);
                    setEditingName("");
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded-full transition-colors"
                      onClick={() => {
                        setSelectedDepartment({
                          ...department,
                          name: department.name as DepartmentType
                        });
                        setIsEditing(true);
                        setDescription(department.description || "");
                        setClasses(department.classes || []);
                        setEditingName(department.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-md sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
                    <DialogHeader className="relative z-10">
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                          <Pencil className="h-5 w-5" />
                        </div>
                        Editar Departamento
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="editName">Nombre</Label>
                        <Input
                          id="editName"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Nombre del departamento"
                          className="w-full"
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
                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl h-12 mt-4"
                        onClick={() => {
                          if (selectedDepartment) {
                            updateDepartmentMutation.mutate({
                              id: selectedDepartment.id,
                              name: editingName,
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
                    className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-full transition-colors"
                    onClick={() => {
                      setSelectedDepartment(department);
                      setIsDeleting(true);
                    }}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                  <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-md rounded-3xl border-red-200/50 dark:border-red-900/30 shadow-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-red-400/10 blur-3xl pointer-events-none"></div>
                    <AlertDialogHeader className="relative z-10">
                      <AlertDialogTitle className="text-xl">¿Está seguro?</AlertDialogTitle>
                      <AlertDialogDescription className="text-base text-slate-600 dark:text-slate-400 mt-2">
                        Esta acción eliminará permanentemente el departamento
                        <span className="font-bold text-slate-900 dark:text-slate-100"> {department.name}</span>.
                        <br /><br />
                        <span className="text-amber-500/90 font-medium">Nota:</span> Si hay estudiantes asignados,
                        serán desvinculados pero no eliminados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="relative z-10 mt-6">
                      <AlertDialogCancel
                        className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => {
                          setIsDeleting(false);
                          setSelectedDepartment(null);
                        }}
                      >
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (selectedDepartment) {
                            deleteDepartmentMutation.mutate(selectedDepartment.id);
                          }
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md shadow-red-500/20"
                      >
                        Sí, Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Departamentos;
