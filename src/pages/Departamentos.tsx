import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department, DepartmentType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Layers, Pencil, Trash2, Plus, X, GraduationCap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LoadingOverlay } from "@/components/LoadingOverlay";
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
    return <LoadingOverlay message="Cargando departamentos..." />;
  }

  const DEPT_PALETTE = [
    { bg: "bg-violet-500", light: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" },
    { bg: "bg-blue-500",   light: "bg-blue-50 dark:bg-blue-900/20",   text: "text-blue-600 dark:text-blue-400",   badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" },
    { bg: "bg-emerald-500",light: "bg-emerald-50 dark:bg-emerald-900/20",text: "text-emerald-600 dark:text-emerald-400",badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" },
    { bg: "bg-amber-500",  light: "bg-amber-50 dark:bg-amber-900/20",  text: "text-amber-600 dark:text-amber-400",  badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
    { bg: "bg-rose-500",   light: "bg-rose-50 dark:bg-rose-900/20",   text: "text-rose-600 dark:text-rose-400",   badge: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800" },
    { bg: "bg-cyan-500",   light: "bg-cyan-50 dark:bg-cyan-900/20",   text: "text-cyan-600 dark:text-cyan-400",   badge: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800" },
  ];

  const totalClasses = departments.reduce((acc, d) => acc + (d.classes?.length ?? 0), 0);

  return (
    <div className="animate-fade-in pb-12">

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 md:px-10 pt-10 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-violet-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Estructura Ministerial</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">Departamentos</h1>
            <p className="text-violet-200 mt-2 text-sm font-medium">
              {departments.length} {departments.length === 1 ? "departamento" : "departamentos"} · {totalClasses} clases/anexos
            </p>
          </div>
          <Button
            onClick={handleCreateClick}
            className="h-11 px-6 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-[10px] uppercase tracking-widest border border-white/20 backdrop-blur-sm gap-2 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nuevo Departamento
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-8 -mt-8 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.length > 0 ? departments.map((department, idx) => {
          const palette = DEPT_PALETTE[idx % DEPT_PALETTE.length];
          return (
            <div
              key={department.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
            >
              {/* Color accent bar */}
              <div className={`h-1.5 w-full ${palette.bg}`} />

              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${palette.light} flex items-center justify-center`}>
                      <Layers className={`h-5 w-5 ${palette.text}`} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight capitalize">
                        {department.name}
                      </h3>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${palette.text}`}>
                        {(department.classes?.length ?? 0)} {(department.classes?.length ?? 0) === 1 ? "clase" : "clases"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600"
                      onClick={() => handleEditClick(department)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog open={isDeleting && selectedDepartment?.id === department.id} onOpenChange={(open) => {
                      if (!open) { setIsDeleting(false); setSelectedDepartment(null); }
                    }}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500"
                          onClick={() => { setSelectedDepartment(department); setIsDeleting(true); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <div className="bg-red-100 p-2 rounded-lg text-red-500"><Trash2 className="h-4 w-4" /></div>
                            ¿Eliminar departamento?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esto eliminará <strong>"{department.name}"</strong> permanentemente. Los miembros asociados serán desvinculados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDepartmentMutation.mutate(department.id)}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Description */}
                {department.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                    {department.description}
                  </p>
                )}

                {/* Classes */}
                <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                  {department.classes && department.classes.length > 0 ? (
                    department.classes.map((cls, i) => (
                      <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${palette.badge}`}>
                        <GraduationCap className="h-2.5 w-2.5" />
                        {cls}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Sin clases/anexos</span>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-24 flex flex-col items-center justify-center gap-4 text-center">
            <div className="h-20 w-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            </div>
            <div>
              <p className="font-black text-slate-400 text-lg">Sin departamentos</p>
              <p className="text-sm text-slate-400 mt-1">Creá el primer departamento ministerial.</p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Dialog Create/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-1.5 rounded-lg text-white">
                {isEditing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </div>
              {isEditing ? "Editar Departamento" : "Nuevo Departamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</Label>
              <Input
                value={isEditing ? editingName : name}
                onChange={(e) => isEditing ? setEditingName(e.target.value) : setName(e.target.value)}
                placeholder="Ej: Ministerio de Alabanza"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Propósito de este departamento..."
                className="rounded-xl min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clases / Anexos</Label>
              <div className="flex gap-2">
                <Input
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  placeholder="Nombre de la clase..."
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddClass())}
                  className="h-10 rounded-xl flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddClass}
                  disabled={!newClass.trim()}
                  variant="secondary"
                  className="h-10 px-4 rounded-xl font-bold text-xs"
                >
                  Agregar
                </Button>
              </div>
              {classes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {classes.map((cls, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg text-xs font-bold">
                      {cls}
                      <button onClick={() => handleRemoveClass(cls)} className="ml-1 hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic pt-1">Sin clases definidas.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-10 px-4 text-xs font-bold">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (isEditing && selectedDepartment) {
                  updateDepartmentMutation.mutate({ id: selectedDepartment.id, name: editingName, description, classes });
                } else {
                  createDepartmentMutation.mutate({ name: name as DepartmentType, description: description.trim() || undefined, classes });
                }
              }}
              disabled={isEditing ? (!editingName || updateDepartmentMutation.isPending) : (!name || createDepartmentMutation.isPending)}
              className="button-gradient rounded-xl h-10 px-6 font-black text-xs uppercase tracking-wider"
            >
              {isEditing ? (updateDepartmentMutation.isPending ? "Guardando..." : "Guardar cambios") : (createDepartmentMutation.isPending ? "Creando..." : "Crear departamento")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Departamentos;
