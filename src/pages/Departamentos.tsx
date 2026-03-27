
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDepartments, updateDepartment, createDepartment, deleteDepartment } from "@/lib/api";
import { Department, DepartmentType } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers, Pencil, Trash, Plus, X } from "lucide-react";
import { Dialog as MuiDialog, DialogTitle as MuiDialogTitle, DialogContent as MuiDialogContent, TextField, Chip, Box } from "@mui/material";
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
        description: "El departamento ha sido eliminado exitosamente y los miembros asociados han sido desvinculados"
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

          <Button onClick={() => setIsCreating(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl whitespace-nowrap">
            <Plus className="h-5 w-5 mr-2" />
            <span>Nuevo Departamento</span>
          </Button>
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
                        <span className="text-amber-500/90 font-medium">Nota:</span> Si hay miembros asignados,
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

      {/* Unified MUI Modal for Create and Edit */}
      <MuiDialog
        open={isCreating || isEditing}
        onClose={() => {
          setIsCreating(false);
          setIsEditing(false);
          setSelectedDepartment(null);
          setName("");
          setEditingName("");
          setDescription("");
          setClasses([]);
          setNewClass("");
        }}
        PaperProps={{
          sx: (theme) => ({
            borderRadius: '24px',
            padding: { xs: '16px', sm: '24px' },
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '500px',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          })
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
          }
        }}
      >
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />

        <MuiDialogTitle sx={{ pb: 1, zIndex: 1, position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex items-center gap-3">
            <div className="bg-purple-100/50 dark:bg-purple-900/30 p-2.5 rounded-2xl text-primary shadow-sm border border-purple-200/50 dark:border-purple-800/50">
              {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">
              {isEditing ? 'Editar Departamento' : 'Crear Departamento'}
            </span>
          </div>
          <button
            onClick={() => {
              setIsCreating(false);
              setIsEditing(false);
              setSelectedDepartment(null);
            }}
            className="p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </MuiDialogTitle>

        <MuiDialogContent sx={{ zIndex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2.5, px: 3, pb: 2, pt: '12px !important' }}>
          <Box>
            <Label className="text-[13px] font-bold text-foreground opacity-80 mb-1.5 block">Nombre</Label>
            <TextField
              fullWidth
              value={isEditing ? editingName : name}
              onChange={(e) => isEditing ? setEditingName(e.target.value) : setName(e.target.value)}
              placeholder="Ej: Escuelita Central"
              variant="outlined"
              size="small"
              InputProps={{
                sx: (theme) => ({
                  borderRadius: '12px',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                  height: '44px',
                  fontSize: '14px',
                  '&:hover fieldset': { borderColor: theme.palette.primary.light },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: '2px' },
                })
              }}
            />
          </Box>

          <Box>
            <Label className="text-[13px] font-bold text-foreground opacity-80 mb-1.5 block">Descripción</Label>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción"
              variant="outlined"
              InputProps={{
                sx: (theme) => ({
                  borderRadius: '16px',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  '&:hover fieldset': { borderColor: theme.palette.primary.light },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: '2px' },
                })
              }}
            />
          </Box>

          <Box>
            <Label className="text-[13px] font-bold text-foreground opacity-80 mb-1.5 block">Clases</Label>
            <div className="flex gap-2 mb-3 items-center">
              <TextField
                fullWidth
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                placeholder="Nombre de la clase"
                variant="outlined"
                size="small"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddClass();
                  }
                }}
                InputProps={{
                  sx: (theme) => ({
                    borderRadius: '12px',
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                    height: '42px',
                    fontSize: '14px',
                    '&:hover fieldset': { borderColor: theme.palette.primary.light },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, borderWidth: '2px' },
                  })
                }}
              />
              <button
                onClick={handleAddClass}
                disabled={!newClass.trim()}
                className="bg-blue-200 dark:bg-blue-900/50 hover:bg-blue-300 dark:hover:bg-blue-800/50 text-blue-800 dark:text-blue-100 font-bold h-[42px] px-5 rounded-[12px] shadow-sm transition-all disabled:opacity-50 text-[14px] border border-blue-300/30"
              >
                Agregar
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {classes.map((className, index) => (
                <Chip
                  key={index}
                  label={className}
                  onDelete={() => handleRemoveClass(className)}
                  deleteIcon={<X size={14} color="#a855f7" />}
                  sx={(theme) => ({
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(126, 34, 206, 0.2)' : '#f3e8ff',
                    color: theme.palette.mode === 'dark' ? '#d8b4fe' : '#7e22ce',
                    fontWeight: 600,
                    borderRadius: '10px',
                    padding: '2px 4px',
                    height: '30px',
                    fontSize: '13.5px',
                    border: theme.palette.mode === 'dark' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid #e9d5ff',
                    boxShadow: '0 2px 4px rgba(147, 51, 234, 0.05)',
                    '& .MuiChip-deleteIcon': {
                      transition: 'all 0.2s',
                      color: theme.palette.mode === 'dark' ? '#a855f7' : '#c084fc',
                      '&:hover': {
                        color: theme.palette.primary.main,
                        transform: 'scale(1.1)'
                      }
                    }
                  })}
                />
              ))}
            </div>
          </Box>

          <button
            onClick={() => {
              if (isEditing && selectedDepartment) {
                updateDepartmentMutation.mutate({
                  id: selectedDepartment.id,
                  name: editingName,
                  description,
                  classes
                });
              } else if (name) {
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
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-purple-500/25 transition-all mt-4 disabled:opacity-70 flex justify-center items-center text-[15px]"
          >
            {isEditing ? (updateDepartmentMutation.isPending ? "Guardando..." : "Guardar Cambios") : (createDepartmentMutation.isPending ? "Creando..." : "Crear Departamento")}
          </button>
        </MuiDialogContent>
      </MuiDialog>
    </div>
  );
};

export default Departamentos;
