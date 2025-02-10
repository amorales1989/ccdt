
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

type AppRole = "admin" | "lider" | "director" | "maestro" | "secretaria";
type Department = "niños" | "adolescentes" | "jovenes" | "adultos";

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  departments: Department[];
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

  // Redirect if not admin or secretaria
  if (profile?.role !== 'admin' && profile?.role !== 'secretaria') {
    navigate('/');
    return null;
  }

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

      // Fetch email addresses for each profile
      const profilesWithEmail = await Promise.all(
        profiles.map(async (profile) => {
          const { data: userData, error: userError } = await supabase
            .from('auth')
            .select('email')
            .eq('id', profile.id)
            .single();

          return {
            ...profile,
            email: userData?.email || ''
          };
        })
      );

      console.log("Fetched profiles:", profilesWithEmail);
      return profilesWithEmail as Profile[];
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async (updatedUser: Profile & { newEmail?: string; newPassword?: string }) => {
      const updatePromises = [];

      // Update profile data
      const profileUpdate = supabase
        .from('profiles')
        .update({
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          role: updatedUser.role as AppRole,
          departments: updatedUser.departments as Department[]
        })
        .eq('id', updatedUser.id);

      updatePromises.push(profileUpdate);

      // Update email if provided
      if (updatedUser.newEmail) {
        const emailUpdate = supabase.auth.admin.updateUserById(
          updatedUser.id,
          { email: updatedUser.newEmail }
        );
        updatePromises.push(emailUpdate);
      }

      // Update password if provided
      if (updatedUser.newPassword) {
        const passwordUpdate = supabase.auth.admin.updateUserById(
          updatedUser.id,
          { password: updatedUser.newPassword }
        );
        updatePromises.push(passwordUpdate);
      }

      await Promise.all(updatePromises);
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
      // Delete auth user (this will cascade to profile due to foreign key)
      const { error } = await supabase.auth.admin.deleteUser(userId);
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
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">
                      {user.first_name} {user.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-sm">Rol: {user.role}</p>
                    <p className="text-sm">
                      Departamentos: {user.departments?.join(", ") || "Ninguno"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isEditing && selectedUser?.id === user.id} onOpenChange={(open) => {
                      if (!open) {
                        setIsEditing(false);
                        setSelectedUser(null);
                        setNewEmail("");
                        setNewPassword("");
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
                          <div>
                            <Label htmlFor="password">Nueva Contraseña (dejar en blanco para no cambiar)</Label>
                            <Input
                              id="password"
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                            />
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
                            <Label>Departamentos</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {["niños", "adolescentes", "jovenes", "adultos"].map((dept) => (
                                <Button
                                  key={dept}
                                  type="button"
                                  variant={selectedUser?.departments?.includes(dept as Department) ? "default" : "outline"}
                                  onClick={() =>
                                    setSelectedUser(prev => {
                                      if (!prev) return null;
                                      const newDepts = prev.departments?.includes(dept as Department)
                                        ? prev.departments.filter(d => d !== dept)
                                        : [...(prev.departments || []), dept as Department];
                                      return { ...prev, departments: newDepts };
                                    })
                                  }
                                  className="w-full capitalize"
                                >
                                  {dept}
                                </Button>
                              ))}
                            </div>
                          </div>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GestionUsuarios;
