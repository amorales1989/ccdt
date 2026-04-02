import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department, DepartmentType } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Pencil, Trash, Plus, X, Info, LayoutTemplate } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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
        description: "El departamento ha sido creado exitosamente",
        variant: "success",
      });
      setIsModalOpen(false);
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
        description: "El departamento ha sido actualizado exitosamente",
        variant: "success",
      });
      setIsModalOpen(false);
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
        description: "El departamento ha sido eliminado exitosamente.",
        variant: "success",
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

  const handleEditClick = (department: Department) => {
    setSelectedDepartment(department);
    setEditingName(department.name);
    setDescription(department.description || "");
    setClasses(department.classes || []);
    setIsCreating(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setName("");
    setDescription("");
    setClasses([]);
    setIsEditing(false);
    setIsCreating(true);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Layers className="h-10 w-10 text-primary animate-pulse" />
        <p className="text-muted-foreground font-medium animate-pulse">Cargando departamentos...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 pb-12 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header Section (Matched with Calendario) */}
      <div className="mb-8 animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-[1.5rem] text-white shadow-xl shadow-purple-500/20 transform hover:rotate-3 transition-transform duration-500">
            <Layers className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">Departamentos</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
              Estructura ministerial y gestión de clases/anexos.
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateClick}
          className="button-gradient shadow-xl shadow-purple-500/20 rounded-2xl h-14 px-8 font-black uppercase tracking-[0.1em] hover:scale-105 active:scale-95 transition-all text-xs"
        >
          <Plus className="h-5 w-5 mr-3" />
          Nuevo Departamento
        </Button>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {departments.length > 0 ? (
          departments.map((department) => (
            <div
              key={department.id}
              className="glass-card hover:bg-white/90 dark:hover:bg-slate-900/90 transition-all duration-500 translate-y-0 hover:-translate-y-2 border-slate-100 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:shadow-purple-500/10 rounded-[2.5rem] p-6 cursor-pointer group flex flex-col h-full relative overflow-hidden min-h-[340px]"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-3xl group-hover:from-purple-500/10 transition-all duration-700"></div>

              <div className="relative z-10 flex flex-col h-full">
                {/* Top Row: Icon & Quick Actions */}
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="bg-purple-50 dark:bg-slate-800 p-3.5 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-purple-100/50 dark:border-slate-700/50">
                    <LayoutTemplate className="h-5 w-5" />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(department);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog open={isDeleting && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsDeleting(false);
                        setSelectedDepartment(null);
                      }
                    }}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepartment(department);
                            setIsDeleting(true);
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2.5rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-red-100 dark:border-red-900/30 shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl text-red-500">
                              <Trash className="h-5 w-5" />
                            </div>
                            ¿Eliminar Departamento?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-medium py-4 text-base">
                            Esta acción eliminará el departamento <span className="font-bold text-slate-800 dark:text-white uppercase tracking-tighter">"{department.name}"</span> permanentemente. Los miembros asociados serán desvinculados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3 pt-4 border-t border-slate-50 dark:border-slate-800">
                          <AlertDialogCancel className="rounded-2xl h-12 uppercase font-black text-[10px] tracking-widest border-slate-200">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDepartmentMutation.mutate(department.id)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-2xl h-12 uppercase font-black text-[10px] tracking-widest shadow-lg shadow-red-500/20"
                          >
                            Eliminar Ahora
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Body: Title & Details */}
                <div className="space-y-5 mb-6 flex-grow">
                  <div>
                    <h4 className="font-black text-xl text-slate-800 dark:text-slate-100 uppercase tracking-tighter group-hover:text-primary transition-colors duration-300">
                      {department.name}
                    </h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      Detalles del Departamento
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-100/50 dark:border-slate-700/50">
                        <Info className="h-4 w-4 shrink-0" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                        {department.description || "Sin descripción proporcionada."}
                      </p>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-indigo-500 shrink-0 border border-slate-100/50 dark:border-slate-700/50">
                        <Layers className="h-4 w-4 shrink-0" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {department.classes && department.classes.length > 0 ? (
                          department.classes.map((className, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="bg-white/50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-lg px-2.5 py-0.5 text-[10px] font-bold shadow-sm"
                            >
                              {className}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin anexos registrados</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="pt-6 border-t border-slate-50 dark:border-slate-800 mt-auto flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl">
                    Registro: Activo
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-5 text-[10px] font-black uppercase text-primary hover:bg-primary/5 rounded-[1.2rem] border border-primary/10 shadow-sm"
                    onClick={() => handleEditClick(department)}
                  >
                    Detalles completos
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-6 animate-pulse">
            <div className="bg-slate-100 dark:bg-slate-900 w-24 h-24 rounded-[3.5rem] flex items-center justify-center text-slate-300 transition-all duration-700">
              <Layers className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">No hay departamentos</h3>
              <p className="text-slate-400 font-medium">Comienza por crear el primer departamento ministerial.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modern Shadcn UI Dialog for Create/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-[2.5rem] bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-purple-100 dark:border-slate-800 shadow-2xl p-0 overflow-hidden max-w-xl w-[95vw]">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none"></div>

          <DialogHeader className="p-4 sm:p-6 pb-0">
            <DialogTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg">
                {isEditing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </div>
              {isEditing ? "Editar Área" : "Nueva Área"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Departamento</Label>
                <Input
                  value={isEditing ? editingName : name}
                  onChange={(e) => isEditing ? setEditingName(e.target.value) : setName(e.target.value)}
                  placeholder="Ej: Ministerio de Alabanza"
                  className="rounded-[1.2rem] h-12 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 focus:ring-primary/20 text-base font-medium px-4"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Descripción del Área</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Propósito de este departamento..."
                  className="rounded-[1.5rem] min-h-[100px] bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 focus:ring-primary/20 text-sm font-medium p-4 resize-none"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Configuración de Clases / Anexos</Label>
                <div className="flex gap-3">
                  <Input
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    placeholder="Nueva clase..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddClass()}
                    className="rounded-2xl h-12 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 px-6"
                  />
                  <Button
                    onClick={handleAddClass}
                    disabled={!newClass.trim()}
                    className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                  >
                    Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar py-1">
                  {classes.map((className, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 pr-1 py-1.5 pl-4 rounded-xl text-xs font-bold flex items-center group/badge"
                    >
                      {className}
                      <button
                        onClick={() => handleRemoveClass(className)}
                        className="ml-2 p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {classes.length === 0 && (
                    <p className="text-[10px] font-medium text-slate-400 italic p-1">No has definido clases aún.</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-6 pt-2 border-t border-slate-50 dark:border-slate-900 sm:justify-between items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl h-12 px-8 font-black uppercase text-[10px] tracking-widest hidden sm:block text-slate-400"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (isEditing && selectedDepartment) {
                    updateDepartmentMutation.mutate({
                      id: selectedDepartment.id,
                      name: editingName,
                      description,
                      classes
                    });
                  } else {
                    createDepartmentMutation.mutate({
                      name: name as DepartmentType,
                      description: description.trim() || undefined,
                      classes
                    });
                  }
                }}
                disabled={
                  (isEditing ? (!editingName || updateDepartmentMutation.isPending) : (!name || createDepartmentMutation.isPending))
                }
                className="button-gradient rounded-[1.5rem] h-12 px-10 font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-purple-500/20 w-full sm:w-auto"
              >
                {isEditing ? (updateDepartmentMutation.isPending ? "Guardando..." : "Guardar") : (createDepartmentMutation.isPending ? "Creando..." : "Crear")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Departamentos;
