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
import { Department } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DepartmentType = Database["public"]["Enums"]["department_type"];
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
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nombre, rol, email, departamento o clase..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No se encontraron usuarios con ese criterio de búsqueda</p>
            ) : (
              filteredUsers.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">
                        {user.first_name} {user.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-sm">Rol: {user.role}</p>
                      <div className="text-sm space-y-1">
                        <p>Departamentos: {user.departments?.join(", ") || "Ninguno"}</p>
                        {user.assigned_class && (
                          <p className="text-sm bg-accent/50 inline-block px-2 py-0.5 rounded">
                            Clase: {user.assigned_class}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
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
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Usuario</DialogTitle>
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
                              className="w-full"
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
                        onClick={() => {
                          if (window.confirm('¿Está seguro de eliminar este usuario?')) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionUsuarios;
