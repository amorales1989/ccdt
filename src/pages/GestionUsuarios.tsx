
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { Department, DepartmentType } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Pencil, Trash2, Eye, EyeOff, Search, ChevronLeft, ChevronRight, Filter, ArrowRight, ArrowLeft, ArrowUpRight, GraduationCap, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomTabs } from "@/components/CustomTabs";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { RegisterUserModal } from "@/components/RegisterUserModal";
import { FileUp } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

type AppRole = Database["public"]["Enums"]["app_role"];

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: DepartmentType[];
  assigned_class?: string;
  email?: string;
};

const GestionUsuarios = () => {
  const [activeTab, setActiveTab] = useState("listado");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [listDepartmentFilter, setListDepartmentFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Assignment states
  const [assignmentDept, setAssignmentDept] = useState<string>("");
  const [assignmentClass, setAssignmentClass] = useState<string>("");
  const [assignmentClasses, setAssignmentClasses] = useState<string[]>([]);
  // Pending assignments: userId -> newClass (string) or null (remove)
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string | null>>({});
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'director' && profile.departments?.[0]) {
      setListDepartmentFilter(profile.departments[0]);
      setAssignmentDept(profile.departments[0]);
    }
  }, [profile]);

  if (profile?.role !== 'admin' && profile?.role !== 'secretaria' && profile?.role !== 'director') {
    navigate('/');
    return null;
  }

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (error) throw error;
      return data as Department[];
    }
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', companyId],
    queryFn: async () => {
      console.log("Fetching profiles...");
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', companyId);

      if (error) {
        console.error("Error fetching profiles:", error);
        throw error;
      }

      const { data: { users: adminUsersData }, error: adminError } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });

      if (adminError) {
        console.error("Error fetching admin users data:", adminError);
        throw adminError;
      }

      const usersData = profiles.map(profile => {
        const adminData = adminUsersData.find((user: any) => user.id === profile.id);
        return {
          ...profile,
          email: adminData?.email || ''
        };
      });

      console.log("Fetched profiles:", usersData);
      return usersData as Profile[];
    }
  });

  useEffect(() => {
    if (selectedDepartment) {
      const department = departments.find(d => d.name === selectedDepartment);
      setAvailableClasses(department?.classes || []);
      setSelectedClass("");
    } else {
      setAvailableClasses([]);
      setSelectedClass("");
    }
  }, [selectedDepartment, departments]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, listDepartmentFilter]);

  // Handle assignment classes
  useEffect(() => {
    if (assignmentDept) {
      const department = departments.find(d => d.name === assignmentDept);
      setAssignmentClasses(department?.classes || []);
      setAssignmentClass("");
    } else {
      setAssignmentClasses([]);
      setAssignmentClass("");
    }
  }, [assignmentDept, departments]);

  // Reset pending when class changes
  useEffect(() => {
    setPendingAssignments({});
  }, [assignmentClass, assignmentDept]);

  const saveClassMutation = useMutation({
    mutationFn: async (assignments: Record<string, string | null>) => {
      const entries = Object.entries(assignments);
      await Promise.all(
        entries.map(async ([userId, newClass]) => {
          const finalClass = newClass === null ? "" : newClass;
          const { error } = await supabase.from('profiles').update({ assigned_class: finalClass }).eq('id', userId).eq('company_id', companyId);
          if (error) {
            throw new Error("No se pudo actualizar la clase: " + error.message);
          }
        })
      );
      // Await refetch so isPending stays true until UI has fresh data (no flash of stale state)
      await queryClient.refetchQueries({ queryKey: ["users"] });
    },
    onSuccess: () => {
      setPendingAssignments({});
      toast({
        title: "Éxito",
        description: "Asignaciones guardadas correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al guardar asignaciones: " + error.message,
        variant: "destructive",
      });
    },
  });

  const bulkResetMutation = useMutation({
    mutationFn: async (department: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ assigned_class: null })
        .eq('company_id', companyId)
        .contains('departments', [department])
        .in('role', ['maestro', 'lider']);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Éxito",
        description: "Todas las clases del departamento han sido limpiadas",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Error al limpiar clases: " + error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (updatedUser: Profile & { newEmail?: string; newPassword?: string }) => {
      const selectedDepartmentObject = departments.find(d => d.name === selectedDepartment);
      if (!selectedDepartmentObject) {
        throw new Error("Departamento no válido");
      }

      const departmentType = selectedDepartmentObject.name as DepartmentType;
      const departmentId = selectedDepartmentObject.id;

      const updateData: any = {
        action: 'update',
        userId: updatedUser.id,
        userData: {
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role,
          departments: [departmentType],
          department_id: departmentId,
          assigned_class: selectedClass,
          company_id: companyId
        }
      };

      if (updatedUser.newEmail) {
        updateData.userData.email = updatedUser.newEmail;
      }

      if (updatedUser.newPassword) {
        updateData.userData.password = updatedUser.newPassword;
      }

      const { error: adminError } = await supabase.functions.invoke('manage-users', {
        body: updateData
      });

      if (adminError) throw adminError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role,
          departments: [departmentType],
          department_id: departmentId,
          assigned_class: selectedClass
        })
        .eq('id', updatedUser.id)
        .eq('company_id', companyId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado exitosamente"
      });
      setIsEditing(false);
      setNewEmail("");
      setNewPassword("");
      setSelectedDepartment(null);
      setSelectedClass("");
    },
    onError: (error) => {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado exitosamente"
      });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el usuario",
        variant: "destructive"
      });
    }
  });

  const filteredUsers = users.filter(user => {
    // Filter by department if selected
    if (listDepartmentFilter !== "all") {
      const userDepts = user.departments || [];
      if (!userDepts.includes(listDepartmentFilter as DepartmentType)) {
        return false;
      }
    } else if (profile?.role === 'director') {
      const userDepts = user.departments || [];
      const directorDept = profile.departments?.[0];
      if (directorDept && !userDepts.includes(directorDept as DepartmentType)) {
        return false;
      }
    }

    if (!searchTerm.trim()) return true;

    const searchTermLower = searchTerm.toLowerCase();
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    const role = user.role.toLowerCase();
    const departments = user.departments?.map(d => d.toLowerCase()).join(' ') || '';
    const assignedClass = (user.assigned_class || '').toLowerCase();

    return fullName.includes(searchTermLower)
      || email.includes(searchTermLower)
      || role.includes(searchTermLower)
      || departments.includes(searchTermLower)
      || assignedClass.includes(searchTermLower);
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Assignment logic filtering (accounts for pending local changes)
  const assignmentFilteredUsers = users.filter(user =>
    (user.role === 'maestro' || user.role === 'lider') &&
    user.departments?.includes(assignmentDept as DepartmentType)
  );

  // Compute effective class for each user (pending overrides DB)
  const getEffectiveClass = (user: Profile) =>
    user.id in pendingAssignments ? pendingAssignments[user.id] : user.assigned_class;

  const availableTeachers = assignmentFilteredUsers.filter(user => {
    const effective = getEffectiveClass(user);
    // Only show truly unassigned teachers (no class at all)
    return !effective;
  });

  const assignedTeachers = assignmentFilteredUsers.filter(user => {
    const effective = getEffectiveClass(user);
    return assignmentClass && effective === assignmentClass;
  });

  const hasPendingChanges = Object.keys(pendingAssignments).length > 0;

  if (isLoading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="animate-fade-in space-y-4 px-4 md:px-6 pb-8 pt-2 md:pt-4 max-w-[1600px] mx-auto relative overflow-hidden">
      {(updateUserMutation.isPending || deleteUserMutation.isPending || saveClassMutation.isPending || bulkResetMutation.isPending) && (
        <LoadingOverlay message="Guardando..." />
      )}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/10 blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-purple-500/30 text-white">
            <Users className="h-6 w-6 sm:h-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Gestión de Usuarios</h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm mt-0.5 sm:mt-1">
              Administra los perfiles, roles y accesos de los miembros.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 relative z-10 w-full">
        <div className="flex flex-col lg:flex-row items-center lg:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-4 w-full justify-between">
            <CustomTabs
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "listado", label: "Lista de Usuarios", icon: Users },
                { value: "asignacion", label: "Asignación de Clases", icon: GraduationCap }
              ]}
            />

            {/* Desktop-only: Nuevo Usuario button aligned far right of tabs */}
            <div className="hidden lg:flex items-center gap-3">
              <Button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-2 h-10 px-5 rounded-xl border border-purple-200 bg-white text-purple-600 hover:bg-purple-50 hover:text-purple-700 font-bold text-sm transition-all shadow-sm"
              >
                <FileUp className="h-4 w-4" />
                Importar Usuarios
              </Button>
              <RegisterUserModal onSuccess={() => queryClient.invalidateQueries({ queryKey: ["users"] })}>
                <Button
                  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 font-bold text-sm transition-all flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Usuario
                </Button>
              </RegisterUserModal>
            </div>
          </div>

          {activeTab === "listado" && (
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-end w-full lg:w-auto animate-in fade-in duration-300">
              <div className="w-full sm:w-64 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100 pointer-events-none" />
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar usuario..."
                    className="pl-10 h-11 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-purple-100 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full sm:w-56">
                <Select value={listDepartmentFilter} onValueChange={setListDepartmentFilter}>
                  <SelectTrigger className="h-11 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-purple-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-purple-500" />
                      <SelectValue placeholder="Filtrar Departamento" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {profile?.role !== 'director' && <SelectItem value="all">Todos los Deptos.</SelectItem>}
                    {departments.filter(dept => profile?.role !== 'director' || profile.departments?.includes(dept.name as DepartmentType)).map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {activeTab === "listado" && (
          <div className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-center text-muted-foreground text-lg">No se encontraron usuarios</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                        <TableRow>
                          <TableHead className="font-bold py-4">Usuario</TableHead>
                          <TableHead className="font-bold py-4">Rol</TableHead>
                          <TableHead className="font-bold py-4 hidden md:table-cell">Departamento</TableHead>
                          <TableHead className="font-bold py-4 hidden sm:table-cell">Clase</TableHead>
                          <TableHead className="text-right font-bold py-4">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((user) => (
                          <TableRow key={user.id} className="group hover:bg-purple-50/30 dark:hover:bg-purple-900/10 transition-colors">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{user.first_name} {user.last_name}</span>
                                <span className="text-xs text-muted-foreground">{user.email || "Sin email"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50 capitalize text-[10px] font-black tracking-wider">
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex flex-wrap gap-1">
                                {user.departments?.length ? user.departments.map((dept, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px] h-5 bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40">
                                    {dept}
                                  </Badge>
                                )) : (
                                  <span className="text-xs text-muted-foreground italic">Ninguno</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {user.assigned_class ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40 text-[10px]">
                                  {user.assigned_class}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Dialog open={isEditing && selectedUser?.id === user.id} onOpenChange={(open) => {
                                  if (!open) {
                                    setIsEditing(false);
                                    setSelectedUser(null);
                                  }
                                }}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded-full transition-colors"
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setIsEditing(true);
                                        setNewEmail(user.email || "");
                                        setSelectedDepartment(user.departments?.[0] || null);
                                        setSelectedClass(user.assigned_class || "");
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="w-[95vw] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle className="text-2xl flex items-center gap-2">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                                          <Pencil className="h-5 w-5" />
                                        </div>
                                        Editar Usuario
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="first_name">Nombre</Label>
                                        <Input id="first_name" value={selectedUser?.first_name || ""} onChange={(e) => setSelectedUser(prev => prev ? { ...prev, first_name: e.target.value } : null)} disabled={updateUserMutation.isPending} />
                                      </div>
                                      <div>
                                        <Label htmlFor="last_name">Apellido</Label>
                                        <Input id="last_name" value={selectedUser?.last_name || ""} onChange={(e) => setSelectedUser(prev => prev ? { ...prev, last_name: e.target.value } : null)} disabled={updateUserMutation.isPending} />
                                      </div>
                                      <div>
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} disabled={updateUserMutation.isPending} />
                                      </div>
                                      <div className="relative">
                                        <Label htmlFor="password">Nueva Contraseña</Label>
                                        <div className="relative">
                                          <Input id="password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" disabled={updateUserMutation.isPending} />
                                          <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => setShowPassword(!showPassword)} disabled={updateUserMutation.isPending}>
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                          </Button>
                                        </div>
                                      </div>
                                      <div>
                                        <Label htmlFor="role">Rol</Label>
                                        <Select value={selectedUser?.role} onValueChange={(value: AppRole) => setSelectedUser(prev => prev ? { ...prev, role: value } : null)} disabled={updateUserMutation.isPending}>
                                          <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="maestro">Maestro</SelectItem>
                                            <SelectItem value="lider">Líder</SelectItem>
                                            <SelectItem value="director">Director</SelectItem>
                                            <SelectItem value="secretaria">Secretaria</SelectItem>
                                            <SelectItem value="secr.-calendario">Secr.-calendario</SelectItem>
                                            <SelectItem value="admin">Administrador</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="department">Departamento</Label>
                                        <Select
                                          value={selectedDepartment || undefined}
                                          onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
                                          disabled={profile?.role === 'director' || updateUserMutation.isPending}
                                        >
                                          <SelectTrigger><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
                                          <SelectContent>
                                            {departments.map((dept) => (
                                              <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {selectedDepartment && availableClasses.length > 0 && (
                                        <div>
                                          <Label htmlFor="class">Clase</Label>
                                          <Select value={selectedClass} onValueChange={setSelectedClass} disabled={updateUserMutation.isPending}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar clase" /></SelectTrigger>
                                            <SelectContent>
                                              {availableClasses.map((className) => (
                                                <SelectItem key={className} value={className}>{className}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                      <Button
                                        className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl h-12 mt-6"
                                        onClick={() => {
                                          if (selectedUser) {
                                            updateUserMutation.mutate({
                                              ...selectedUser,
                                              newEmail: newEmail !== selectedUser.email ? newEmail : undefined,
                                              newPassword: newPassword || undefined
                                            });
                                          }
                                        }}
                                        disabled={updateUserMutation.isPending}
                                      >
                                        {updateUserMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-full transition-colors"
                                  disabled={deleteUserMutation.isPending}
                                  onClick={() => {
                                    setUserToDelete(user.id);
                                    setIsDeleteDialogOpen(true);
                                  }}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
                    <p className="text-sm text-muted-foreground">
                      Mostrando <span className="font-bold text-foreground">{startIndex + 1}</span> a <span className="font-bold text-foreground">{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</span> de <span className="font-bold text-foreground">{filteredUsers.length}</span> usuarios
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-lg" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" className={`h-9 w-9 rounded-lg ${currentPage === page ? 'bg-purple-600 hover:bg-purple-700' : ''}`} onClick={() => setCurrentPage(page)}>
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="h-9 px-3 rounded-lg" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                        Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "asignacion" && (
          <div className="space-y-6 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col lg:flex-row gap-4 items-end bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />

              <div className="w-full md:w-64 space-y-2 relative z-10">
                <div className="flex items-center justify-between ml-1">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Departamento</Label>
                  <RegisterUserModal onSuccess={() => queryClient.invalidateQueries({ queryKey: ["users"] })}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden h-6 w-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition-all"
                      title="Nuevo Usuario"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </RegisterUserModal>
                </div>
                <Select value={assignmentDept} onValueChange={setAssignmentDept}>
                  <SelectTrigger className="h-11 rounded-xl bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Seleccionar Depto." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                    {departments.filter(dept => profile?.role !== 'director' || profile.departments?.includes(dept.name as DepartmentType)).map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-64 space-y-2 relative z-10">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 ml-1">Clase Destino</Label>
                <Select value={assignmentClass} onValueChange={setAssignmentClass} disabled={!assignmentDept}>
                  <SelectTrigger className="h-11 rounded-xl bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Seleccionar Clase" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                    {assignmentClasses.map((className) => (
                      <SelectItem key={className} value={className}>{className}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-grow"></div>

              <div className="flex flex-row items-center gap-2 sm:gap-4 w-full md:w-auto relative z-10 pb-0.5">
                <div className="flex items-center gap-2 sm:gap-3 text-slate-600 dark:text-slate-400 text-sm font-bold bg-white/80 dark:bg-slate-800/80 px-3 sm:px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span>{assignmentFilteredUsers.length}</span>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border-red-200 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white px-5 transition-all duration-300 shadow-sm whitespace-nowrap"
                      disabled={!assignmentDept || bulkResetMutation.isPending}
                    >
                      <span className="text-sm font-bold">Limpiar clases</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl p-8">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                          <Trash2 className="h-6 w-6" />
                        </div>
                        Limpiar Clases
                      </DialogTitle>
                      <div className="py-6 text-slate-600 dark:text-slate-400 leading-relaxed">
                        ¿Estás seguro de que deseas quitar todas las clases asignadas a los maestros y líderes del departamento <span className="font-bold text-red-600 dark:text-red-400">"{assignmentDept}"</span>?
                        <p className="mt-3 text-sm flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                          <ArrowLeft className="h-4 w-4 rotate-45" /> Esta acción dejará a todo el personal disponible para reasignar clases.
                        </p>
                      </div>
                    </DialogHeader>
                    <div className="flex flex-col sm:flex-row justify-end gap-3 mt-2">
                      <DialogTrigger asChild>
                        <Button variant="ghost" className="rounded-xl h-11 px-6">Cancelar</Button>
                      </DialogTrigger>
                      <Button
                        variant="destructive"
                        onClick={() => bulkResetMutation.mutate(assignmentDept)}
                        disabled={bulkResetMutation.isPending}
                        className="rounded-xl bg-red-600 hover:bg-red-700 h-11 px-6 shadow-lg shadow-red-200 dark:shadow-none"
                      >
                        {bulkResetMutation.isPending ? "Limpiando..." : "Confirmar Limpiar"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  className={`h-11 rounded-xl px-5 transition-all duration-300 shadow-sm whitespace-nowrap font-bold text-sm ${hasPendingChanges ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-500/20' : 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-700 text-slate-500'}`}
                  disabled={!hasPendingChanges || saveClassMutation.isPending}
                  onClick={() => saveClassMutation.mutate(pendingAssignments)}
                >
                  {saveClassMutation.isPending ? "Guardando..." : `Guardar Clase${hasPendingChanges ? ` (${Object.keys(pendingAssignments).length})` : ''}`}
                </Button>
              </div>
            </div>

            {!assignmentDept || !assignmentClass ? (
              <div className="flex flex-col items-center justify-center p-20 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full mb-4">
                  <GraduationCap className="h-10 w-10 text-purple-600 dark:text-purple-400 opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Asignación de Clases</h3>
                <p className="text-center text-muted-foreground max-w-sm mt-2">
                  Selecciona un departamento y una clase para comenzar a organizar a tus maestros y líderes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Disponibles</h3>
                    <Badge variant="secondary">{availableTeachers.length}</Badge>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider">
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Actual</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableTeachers.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No hay maestros disponibles</TableCell></TableRow>
                        ) : (
                          availableTeachers.map((user) => (
                            <TableRow key={user.id} className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10">
                              <TableCell className="py-3">
                                <div className="font-bold text-slate-700 dark:text-slate-300">{user.first_name} {user.last_name}</div>
                                <div className="text-[10px] text-muted-foreground uppercase">{user.role}</div>
                              </TableCell>
                              <TableCell className="py-3 text-xs">
                                {(() => { const eff = getEffectiveClass(user); return eff ? <Badge variant="outline" className={`h-5 text-[10px] ${user.id in pendingAssignments ? 'border-amber-400 text-amber-600' : ''}`}>{eff}</Badge> : <span className="text-muted-foreground">Sin clase</span>; })()}
                              </TableCell>
                              <TableCell className="text-right py-3">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 p-0"
                                  onClick={() => setPendingAssignments(prev => ({ ...prev, [user.id]: assignmentClass }))}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div>En la Clase: <span className="text-purple-600 dark:text-purple-400">{assignmentClass}</span></h3>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{assignedTeachers.length}</Badge>
                  </div>
                  <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm ring-1 ring-green-500/20">
                    <Table>
                      <TableHeader className="bg-green-50/30 dark:bg-green-900/10 text-[11px] uppercase tracking-wider">
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead className="text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignedTeachers.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">Ningún maestro asignado</TableCell></TableRow>
                        ) : (
                          assignedTeachers.map((user) => (
                            <TableRow key={user.id} className="group hover:bg-green-50/30 dark:hover:bg-green-900/10">
                              <TableCell className="py-3">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-0"
                                  onClick={() => setPendingAssignments(prev => ({ ...prev, [user.id]: user.assigned_class === assignmentClass ? "" : user.assigned_class || "" }))}
                                >
                                  <ArrowLeft className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="py-3"><div className="font-bold text-slate-800 dark:text-slate-200">{user.first_name} {user.last_name}</div></TableCell>
                              <TableCell className="py-3"><Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[9px]">{user.role}</Badge></TableCell>
                              <TableCell className="text-right py-3">
                                {user.id in pendingAssignments
                                  ? <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" title="Cambio pendiente" />
                                  : <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <BulkImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (userToDelete) deleteUserMutation.mutate(userToDelete);
        }}
        title="¿Eliminar usuario?"
        description="Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta y el perfil del usuario."
        isLoading={deleteUserMutation.isPending}
      />
    </div >
  );
};

export default GestionUsuarios;
