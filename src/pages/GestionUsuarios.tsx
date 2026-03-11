
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
import { Users, Pencil, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  if (profile?.role !== 'admin' && profile?.role !== 'secretaria') {
    navigate('/');
    return null;
  }

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Department[];
    }
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      console.log("Fetching profiles...");
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');

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
          assigned_class: selectedClass
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
        .eq('id', updatedUser.id);

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

  if (isLoading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Gestión de Usuarios</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Administra los perfiles, roles y accesos de los miembros.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-80 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-0 group-hover:opacity-100 pointer-events-none" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nombre, rol, email..."
                className="pl-10 h-12 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-purple-100 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
            <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-center text-muted-foreground text-lg">No se encontraron usuarios con ese criterio de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 rounded-3xl p-6 relative overflow-hidden group flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/5 rounded-full blur-2xl group-hover:bg-purple-400/10 transition-colors pointer-events-none" />

                <div className="relative z-10 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {user.first_name} {user.last_name}
                      </h3>
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">{user.email || "Sin email registrado"}</p>
                    </div>
                    <span className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border border-purple-200/50 dark:border-purple-800/30">
                      {user.role}
                    </span>
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Departamentos</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {user.departments?.length ? user.departments.join(", ") : "Ninguno asignado"}
                      </p>
                    </div>

                    {user.assigned_class && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30">
                        <p className="text-xs font-semibold uppercase tracking-wider text-purple-600/70 dark:text-purple-400/70 mb-1">Clase Asignada</p>
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                          {user.assigned_class}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
                  <Dialog open={isEditing && selectedUser?.id === user.id} onOpenChange={(open) => {
                    if (!open) {
                      setIsEditing(false);
                      setSelectedUser(null);
                      setNewEmail("");
                      setNewPassword("");
                      setShowPassword(false);
                      setSelectedDepartment(null);
                      setSelectedClass("");
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded-full transition-colors"
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
                    <DialogContent className="w-[95vw] max-w-md sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
                      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
                      <DialogHeader className="relative z-10">
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
                          <Input
                            id="first_name"
                            value={selectedUser?.first_name || ""}
                            onChange={(e) =>
                              setSelectedUser(prev => prev ? {
                                ...prev,
                                first_name: e.target.value
                              } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="last_name">Apellido</Label>
                          <Input
                            id="last_name"
                            value={selectedUser?.last_name || ""}
                            onChange={(e) =>
                              setSelectedUser(prev => prev ? {
                                ...prev,
                                last_name: e.target.value
                              } : null)
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                          />
                        </div>
                        <div className="relative">
                          <Label htmlFor="password">Nueva Contraseña</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="role">Rol</Label>
                          <Select
                            value={selectedUser?.role}
                            onValueChange={(value: AppRole) =>
                              setSelectedUser(prev => prev ? {
                                ...prev,
                                role: value
                              } : null)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
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
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar departamento" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.name}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedDepartment && availableClasses.length > 0 && (
                          <div>
                            <Label htmlFor="class">Clase</Label>
                            <Select
                              value={selectedClass}
                              onValueChange={setSelectedClass}
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
                        >
                          Guardar Cambios
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 rounded-full transition-colors"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de eliminar este usuario?')) {
                        deleteUserMutation.mutate(user.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionUsuarios;
