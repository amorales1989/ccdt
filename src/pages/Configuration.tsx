import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCompany, updateCompany, getWhatsappStatus, connectWhatsapp, disconnectWhatsapp, testWhatsappMessage } from "@/lib/api";
import { Loader2, Moon, Sun, Upload, X, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Settings } from "lucide-react";
import { supabase, STORAGE_URL } from "@/integrations/supabase/client";
import { FcmDebug } from "@/components/FcmDebug";

export default function Configuration() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [congregationName, setCongregationName] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [whatsappInfo, setWhatsappInfo] = useState<{ status: string; qr: string | null }>({ status: 'disconnected', qr: null });
  const [isConnectingWhatsapp, setIsConnectingWhatsapp] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [testMessage, setTestMessage] = useState("¡Hola! Mensaje de prueba de WhatsApp.");
  const [isSendingTest, setIsSendingTest] = useState(false);

  const [generalSettings, setGeneralSettings] = useState({
    darkMode: false,
    autoSave: true,
    notifications: true,
    showName: true,
  });

  const [displaySettings, setDisplaySettings] = useState({
    showAttendanceHistory: true,
    compactView: false,
    showProfileImages: true,
  });

  const { data: company, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => getCompany(1)
  });

  const { mutate: updateCompanyMutate } = useMutation({
    mutationFn: (updates: Partial<typeof company>) => updateCompany(1, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({
        title: "Información actualizada",
        description: "La configuración ha sido actualizada con éxito",
      });
    },
    onError: (error) => {
      console.error("Error updating company:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la información de la empresa",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (!company) return;

    setCongregationName(company.congregation_name || company.name || '');

    if (company.logo_url) {
      if (company.logo_url.startsWith('logos/')) {
        setLogoPreview(`${STORAGE_URL}/logos/${company.logo_url.split('logos/')[1]}`);
      } else {
        setLogoPreview(company.logo_url);
      }
    } else {
      setLogoPreview('/fire.png');
    }

    setGeneralSettings({
      darkMode: company.dark_mode || false,
      autoSave: company.auto_save !== false,
      notifications: company.notifications !== false,
      showName: company.show_name !== false
    });

    setDisplaySettings({
      showAttendanceHistory: company.show_attendance_history !== false,
      compactView: company.compact_view || false,
      showProfileImages: company.show_profile_images !== false
    });
  }, [company]);

  // Polling para el estado de WhatsApp
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getWhatsappStatus(1); // Usando id 1 como en el resto de la página
        if (res.success) {
          setWhatsappInfo({ status: res.status, qr: res.qr });
        }
      } catch (err) {
        console.error("Error polling WhatsApp status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectWhatsapp = async () => {
    try {
      setIsConnectingWhatsapp(true);
      await connectWhatsapp(1);
      toast({
        title: "Conectando...",
        description: "Iniciando proceso de conexión de WhatsApp",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la conexión",
        variant: "destructive",
      });
    } finally {
      setIsConnectingWhatsapp(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    try {
      await disconnectWhatsapp(1);
      toast({
        title: "WhatsApp",
        description: "Se ha solicitado la desconexión",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo desconectar",
        variant: "destructive",
      });
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhoneNumber) {
      toast({
        title: "Campo requerido",
        description: "Por favor ingresa un número de teléfono",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingTest(true);
      await testWhatsappMessage(1, testPhoneNumber, testMessage);
      toast({
        title: "Mensaje enviado",
        description: "El mensaje de prueba se ha enviado exitosamente",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Verifica la conexión.",
        variant: "destructive",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleGeneralSettingChange = (setting: keyof typeof generalSettings) => {
    const newValue = !generalSettings[setting];

    setGeneralSettings(prev => ({
      ...prev,
      [setting]: newValue
    }));

    const settingMap: Record<string, string> = {
      darkMode: 'dark_mode',
      autoSave: 'auto_save',
      notifications: 'notifications',
      showName: 'show_name'
    };

    if (setting === 'darkMode') {
      toggleTheme();
    } else {
      updateCompanyMutate({
        [settingMap[setting]]: newValue
      });
    }
  };

  const handleDisplaySettingChange = (setting: keyof typeof displaySettings) => {
    const newValue = !displaySettings[setting];

    setDisplaySettings(prev => ({
      ...prev,
      [setting]: newValue
    }));

    const settingMap: Record<string, string> = {
      showAttendanceHistory: 'show_attendance_history',
      compactView: 'compact_view',
      showProfileImages: 'show_profile_images'
    };

    updateCompanyMutate({
      [settingMap[setting]]: newValue
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          setLogoPreview(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShowImagePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setShowImagePreview(true);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    try {
      setIsUploading(true);

      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { data, error } = await supabase.storage
        .from('logos')
        .upload(filePath, logoFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      await updateCompanyMutate({
        logo_url: publicUrl
      });

      toast({
        title: "Logo subido",
        description: "El logo ha sido subido y guardado correctamente",
      });

    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Error",
        description: "No se pudo subir el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearLogo = async () => {
    try {
      await updateCompanyMutate({
        logo_url: null
      });

      setLogoPreview('/fire.png');
      setLogoFile(null);

      toast({
        title: "Logo eliminado",
        description: "Se ha restaurado el logo por defecto",
      });
    } catch (error) {
      console.error("Error clearing logo:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el logo",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = () => {
    try {
      const updates: any = {
        congregation_name: congregationName
      };

      updateCompanyMutate(updates);

      toast({
        title: "Configuración guardada",
        description: "Los cambios han sido aplicados exitosamente",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
    }
  };

  const handleCongregationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCongregationName(e.target.value);
  };

  const handleClearCongregationName = () => {
    setCongregationName('');
    updateCompanyMutate({ congregation_name: '' });

    toast({
      title: "Nombre eliminado",
      description: "El nombre de la congregación ha sido eliminado",
    });
  };

  if (!profile || (profile.role !== "admin" && profile.role !== "secretaria")) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isCompanyLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="ml-2">Cargando configuración...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
              <Settings className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Configuración</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Ajusta las preferencias generales, visualización y notificaciones del sistema.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl px-6 h-12 transition-all hover:shadow-lg hover:shadow-purple-500/30"
            >
              Guardar Cambios
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-purple-100 dark:border-slate-800 p-2 rounded-2xl flex flex-wrap w-full md:w-fit justify-center shadow-sm gap-1 md:gap-2 h-auto">
          <TabsTrigger value="general" className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">General</TabsTrigger>
          <TabsTrigger value="display" className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Visualización</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Notificaciones</TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">WhatsApp</TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 outline-none">
          <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 -ml-32 -mt-32 w-96 h-96 rounded-full bg-purple-400/10 blur-3xl pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 px-6 sm:px-8 pt-6 sm:pt-8">
              <CardTitle className="text-2xl font-bold">Configuración General</CardTitle>
              <CardDescription className="text-base mt-2">
                Configura las opciones generales de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10 px-6 sm:px-8 pb-8">
              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-6">
                <h3 className="text-lg font-bold">Personalización</h3>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="congregation-name" className="text-sm font-semibold">Nombre de la Congregación</Label>
                    <div className="flex gap-2">
                      <Input
                        id="congregation-name"
                        placeholder="Ej. Comunidad Cristiana Don Torcuato"
                        value={congregationName}
                        onChange={handleCongregationNameChange}
                        className="flex-1 h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-sm"
                      />
                      <Button
                        variant="outline"
                        type="button"
                        onClick={handleClearCongregationName}
                        className="rounded-xl h-11 border-slate-300 dark:border-slate-600 shadow-sm"
                      >
                        Eliminar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este nombre se mostrará en la parte superior del menú lateral y en la página de inicio de sesión.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 shadow-sm">
                    <Label htmlFor="show-name" className="flex flex-col cursor-pointer">
                      <span className="text-sm font-bold text-foreground">Mostrar Nombre de Congregación</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Determina si se muestra el nombre de la congregación en el menú lateral y en la página de inicio.
                      </span>
                    </Label>
                    <Switch
                      id="show-name"
                      checked={generalSettings.showName}
                      onCheckedChange={() => handleGeneralSettingChange('showName')}
                    />
                  </div>

                  <div className="space-y-4 p-5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 shadow-sm">
                    <Label htmlFor="logo-upload" className="text-sm font-bold text-foreground">Logo personalizado</Label>
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="flex-1">
                        <Input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="w-full h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer file:cursor-pointer shadow-sm file:bg-purple-100 file:text-purple-700 dark:file:bg-purple-900/30 dark:file:text-purple-300 file:border-0 file:rounded-lg file:mx-2 file:my-1 file:px-4"
                        />
                        <div className="flex flex-wrap gap-3 mt-4">
                          <Button
                            variant={logoFile ? "default" : "outline"}
                            type="button"
                            onClick={handleUploadLogo}
                            disabled={!logoFile || isUploading}
                            className={`flex items-center rounded-xl h-10 ${logoFile ? "bg-green-500 hover:bg-green-600 text-white shadow-md shadow-green-500/20" : ""}`}
                          >
                            {isUploading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Subir Logo
                          </Button>
                          <Button
                            variant="outline"
                            type="button"
                            onClick={handleClearLogo}
                            className="flex items-center text-xs rounded-xl h-10 text-muted-foreground hover:text-foreground border-slate-200 dark:border-slate-700"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Restaurar por def.
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center min-w-[120px] bg-slate-100 dark:bg-slate-800/50 rounded-xl p-2 h-[120px]">
                        {logoPreview ? (
                          <div className="relative group w-full h-full flex items-center justify-center">
                            <img
                              src={logoPreview}
                              alt="Logo Preview"
                              className="max-h-24 w-auto max-w-[100px] object-contain drop-shadow-sm group-hover:drop-shadow-md transition-all cursor-pointer"
                              onClick={() => handleShowImagePreview(logoPreview)}
                            />
                            <Button
                              variant="secondary"
                              size="icon"
                              className="absolute -top-1 -right-1 h-7 w-7 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
                              onClick={() => handleShowImagePreview(logoPreview)}
                            >
                              <span className="sr-only">Ver Logo</span>
                              <span className="text-[10px]">🔎</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground text-center">Sin Logo<br />Elegido</div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 px-1">
                      Este logo se mostrará en la página de inicio de sesión. Recomendamos usar una imagen de al menos 200x200 píxeles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 space-y-4">
                <h3 className="text-lg font-bold mb-4">Otras Configuraciones</h3>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <Label htmlFor="dark-mode" className="flex flex-col cursor-pointer">
                    <span className="text-sm font-bold text-foreground">Modo Oscuro</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Cambia la apariencia de la aplicación a un tema oscuro.
                    </span>
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
                      {theme === "light" ? (
                        <Sun className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Moon className="h-4 w-4 text-indigo-400" />
                      )}
                    </div>
                    <Switch
                      id="dark-mode"
                      checked={generalSettings.darkMode}
                      onCheckedChange={() => handleGeneralSettingChange('darkMode')}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <Label htmlFor="auto-save" className="flex flex-col cursor-pointer">
                    <span className="text-sm font-bold text-foreground">Autoguardado</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Guarda automáticamente los cambios realizados.
                    </span>
                  </Label>
                  <Switch
                    id="auto-save"
                    checked={generalSettings.autoSave}
                    onCheckedChange={() => handleGeneralSettingChange('autoSave')}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 shadow-sm">
                  <Label htmlFor="notifications" className="flex flex-col cursor-pointer">
                    <span className="text-sm font-bold text-foreground">Notificaciones Push</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Habilita las notificaciones de la aplicación.
                    </span>
                  </Label>
                  <Switch
                    id="notifications"
                    checked={generalSettings.notifications}
                    onCheckedChange={() => handleGeneralSettingChange('notifications')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display" className="mt-0 outline-none">
          <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 px-6 sm:px-8 pt-6 sm:pt-8">
              <CardTitle className="text-2xl font-bold">Configuración de Visualización</CardTitle>
              <CardDescription className="text-base mt-2">
                Personaliza cómo se muestra la información en la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10 px-6 sm:px-8 pb-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
                <Label htmlFor="attendance-history" className="flex flex-col">
                  <span className="text-base font-medium">Mostrar Historial de Asistencia</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Muestra el historial de asistencia en la página de alumnos.
                  </span>
                </Label>
                <Switch
                  id="attendance-history"
                  checked={displaySettings.showAttendanceHistory}
                  onCheckedChange={() => handleDisplaySettingChange('showAttendanceHistory')}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
                <Label htmlFor="compact-view" className="flex flex-col">
                  <span className="text-base font-medium">Vista Compacta</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Muestra más información en menos espacio.
                  </span>
                </Label>
                <Switch
                  id="compact-view"
                  checked={displaySettings.compactView}
                  onCheckedChange={() => handleDisplaySettingChange('compactView')}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
                <Label htmlFor="profile-images" className="flex flex-col">
                  <span className="text-base font-medium">Mostrar Imágenes de Perfil</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    Muestra las imágenes de perfil de los alumnos en las listas.
                  </span>
                </Label>
                <Switch
                  id="profile-images"
                  checked={displaySettings.showProfileImages}
                  onCheckedChange={() => handleDisplaySettingChange('showProfileImages')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 outline-none">
          <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 px-6 sm:px-8 pt-6 sm:pt-8">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                Notificaciones Push (FCM)
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Depuración y configuración de notificaciones Push para dispositivos móviles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10 px-6 sm:px-8 pb-8">
              <FcmDebug />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-0 outline-none">
          <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-green-400/10 blur-3xl pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 px-6 sm:px-8 pt-6 sm:pt-8">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl text-green-600 dark:text-green-400">
                  <Smartphone className="h-6 w-6" />
                </div>
                Vinculación de WhatsApp
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Vincula tu dispositivo mediante código QR para automatizar el envío de mensajes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10 px-6 sm:px-8 pb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-green-100 dark:bg-green-900/30' :
                    whatsappInfo.status === 'qr' ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                    <div className={`h-4 w-4 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]' :
                      whatsappInfo.status === 'qr' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                  </div>
                  <div>
                    <p className="font-bold text-lg">
                      Estado: {
                        whatsappInfo.status === 'connected' ? 'Conectado' :
                          whatsappInfo.status === 'qr' ? 'Esperando escaneo' : 'Desconectado'
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {whatsappInfo.status === 'connected' ? 'El servicio está operativo.' : 'Vincule su cuenta para comenzar.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {whatsappInfo.status === 'disconnected' && (
                    <Button onClick={handleConnectWhatsapp} disabled={isConnectingWhatsapp} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white rounded-xl h-11">
                      {isConnectingWhatsapp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Vincular Dispositivo
                    </Button>
                  )}
                  {whatsappInfo.status !== 'disconnected' && (
                    <Button variant="outline" onClick={handleDisconnectWhatsapp} className="w-full sm:w-auto text-destructive border-destructive hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl h-11">
                      <X className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>

              {whatsappInfo.status === 'qr' && whatsappInfo.qr && (
                <div className="flex flex-col items-center justify-center p-8 border border-slate-200 dark:border-slate-700 rounded-3xl bg-white dark:bg-slate-900 shadow-inner">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl mb-6 border border-slate-100 dark:border-slate-700 inline-block">
                    <img src={whatsappInfo.qr} alt="WhatsApp QR" className="w-64 h-64 mix-blend-multiply dark:mix-blend-normal rounded-xl" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-center text-foreground">Escanee el código QR</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Abra WhatsApp en su teléfono, vaya a <strong>Dispositivos vinculados</strong> y toque <strong>Vincular un dispositivo</strong> para escanear este código.
                  </p>
                </div>
              )}

              {whatsappInfo.status === 'connected' && (
                <div className="space-y-6 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Prueba de Envío
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="test-phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Número de Teléfono</Label>
                      <Input
                        id="test-phone"
                        placeholder="Ej: 54911..."
                        value={testPhoneNumber}
                        onChange={(e) => setTestPhoneNumber(e.target.value)}
                        className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test-msg" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Mensaje de Prueba</Label>
                      <Input
                        id="test-msg"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md shadow-green-500/20 rounded-xl h-12 mt-2 transition-all"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest}
                  >
                    {isSendingTest ? <Loader2 className="h-5 w-5 mr-3 animate-spin" /> : "Enviar Mensaje de Prueba"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-0 outline-none">
          <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-red-400/10 blur-3xl pointer-events-none"></div>
            <CardHeader className="relative z-10 border-b border-slate-100 dark:border-slate-800 pb-6 mb-6 px-6 sm:px-8 pt-6 sm:pt-8">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-slate-600 dark:text-slate-400">
                  <Settings className="h-5 w-5" />
                </div>
                Configuración del Sistema
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Ajustes avanzados del sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 relative z-10 px-6 sm:px-8 pb-8">
              <div className="space-y-3 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <h3 className="text-lg font-bold">Backup y Restauración</h3>
                <p className="text-sm text-muted-foreground">
                  Gestiona la copia de seguridad y restauración de datos guardados temporal o localmente.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="outline" className="rounded-xl h-11 border-slate-300 dark:border-slate-600">Generar Backup</Button>
                  <Button variant="outline" className="rounded-xl h-11 border-slate-300 dark:border-slate-600">Restaurar Datos</Button>
                </div>
              </div>

              <div className="space-y-3 bg-red-50/50 dark:bg-red-900/10 p-6 rounded-2xl border border-red-100 dark:border-red-900/30">
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Zona de Peligro</h3>
                <p className="text-sm text-muted-foreground">
                  Borra datos caché del sistema y ajustes. Esta acción no se puede deshacer.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="destructive" className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11">Borrar Caché</Button>
                  <Button variant="destructive" className="bg-red-500 hover:bg-red-600 text-white rounded-xl h-11">Resetear Configuración</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSaveSettings}>Guardar Configuración</Button>
      </div>

      {showImagePreview && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Vista Previa</DialogTitle>
              <DialogDescription>
                Vista ampliada del logo seleccionado.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-6">
              <img
                src={previewImage}
                alt="Logo Preview"
                className="max-h-96 max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

