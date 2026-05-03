
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CustomTabs } from "@/components/CustomTabs";

const profileSchema = z.object({
  first_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  last_name: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "La contraseña actual debe tener al menos 6 caracteres"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "La confirmación debe tener al menos 6 caracteres"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

interface ProfileEditorProps {
  onClose: () => void;
}

export function ProfileEditor({ onClose }: ProfileEditorProps) {
  const { profile, user, getProfile } = useAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const queryClient = useQueryClient();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || "",
      last_name: profile?.last_name || "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateProfile = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Perfil actualizado",
        description: "Tu información ha sido actualizada correctamente",
      });

      // Invalidate profile data in the cache
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      // Refresh the profile in the Auth context
      if (getProfile) {
        await getProfile(user.id);
      }

      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil. Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const changePassword = async (values: z.infer<typeof passwordSchema>) => {
    if (!user) return;

    setIsChangingPassword(true);

    try {
      // First verify current password is correct
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: values.currentPassword,
      });

      if (signInError) {
        throw new Error("La contraseña actual es incorrecta");
      }

      // Update to new password
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido actualizada correctamente",
      });

      passwordForm.reset();
      onClose();
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la contraseña. Inténtalo nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const tabOptions = [
    { value: "profile", label: "Perfil" },
    { value: "password", label: "Contraseña" }
  ];

  return (
    <div className="w-full">
      <CustomTabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as "profile" | "password")}
        options={tabOptions}
        className="w-full mb-4"
      />

      {activeTab === "profile" && (
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(updateProfile)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={profileForm.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Tu nombre"
                        {...field}
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-purple-500 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Tu apellido"
                        {...field}
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-purple-500 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={onClose} className="rounded-xl h-12 px-6">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="rounded-xl h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/20"
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </Form>
      )}

      {activeTab === "password" && (
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-6">
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contraseña Actual</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Tu contraseña actual"
                      {...field}
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-purple-500 transition-all"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nueva Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        {...field}
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-purple-500 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Confirmar Contraseña</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Repite la nueva contraseña"
                        {...field}
                        className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-2 focus:ring-purple-500 transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={onClose} className="rounded-xl h-12 px-6">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isChangingPassword}
                className="rounded-xl h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/20"
              >
                {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Actualizar Contraseña
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
