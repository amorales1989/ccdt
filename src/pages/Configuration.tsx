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
import { Loader2, Moon, Sun, Upload, X, Smartphone, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
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
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Configuración</h1>

      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="display">Visualización</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
              <CardDescription>
                Configura las opciones generales de la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Personalización</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="congregation-name">Nombre de la Congregación</Label>
                    <div className="flex gap-2">
                      <Input
                        id="congregation-name"
                        placeholder="Ej. Comunidad Cristiana Don Torcuato"
                        value={congregationName}
                        onChange={handleCongregationNameChange}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        type="button"
                        onClick={handleClearCongregationName}
                      >
                        Eliminar
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Este nombre se mostrará en la parte superior del menú lateral y en la página de inicio de sesión.
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <Label htmlFor="show-name" className="flex flex-col">
                      <span>Mostrar Nombre de Congregación</span>
                      <span className="text-sm text-muted-foreground">
                        Determina si se muestra el nombre de la congregación en el menú lateral y en la página de inicio.
                      </span>
                    </Label>
                    <Switch
                      id="show-name"
                      checked={generalSettings.showName}
                      onCheckedChange={() => handleGeneralSettingChange('showName')}
                    />
                  </div>

                  <div className="space-y-2 border p-4 rounded-md">
                    <Label htmlFor="logo-upload">Logo</Label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <Input
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="max-w-md mb-2"
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            variant={logoFile ? "success" : "outline"}
                            type="button"
                            onClick={handleUploadLogo}
                            disabled={!logoFile || isUploading}
                            className={`flex items-center ${logoFile ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
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
                            className="flex items-center text-xs"
                            size="sm"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Restaurar
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        {logoPreview && (
                          <div className="relative">
                            <img
                              src={logoPreview}
                              alt="Logo Preview"
                              className="h-24 w-auto object-contain border rounded p-2"
                              onClick={() => handleShowImagePreview(logoPreview)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                              onClick={() => handleShowImagePreview(logoPreview)}
                            >
                              <span className="sr-only">Ver Logo</span>
                              🔍
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Este logo se mostrará en la página de inicio de sesión. Recomendamos usar una imagen cuadrada de al menos 200x200 píxeles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-lg font-medium mb-4">Otras Configuraciones</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode" className="flex flex-col">
                    <span>Modo Oscuro</span>
                    <span className="text-sm text-muted-foreground">
                      Cambia la apariencia de la aplicación a un tema oscuro.
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    {theme === "light" ? (
                      <Sun className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Moon className="h-5 w-5 text-indigo-300" />
                    )}
                    <Switch
                      id="dark-mode"
                      checked={generalSettings.darkMode}
                      onCheckedChange={() => handleGeneralSettingChange('darkMode')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Label htmlFor="auto-save" className="flex flex-col">
                    <span>Autoguardado</span>
                    <span className="text-sm text-muted-foreground">
                      Guarda automáticamente los cambios realizados.
                    </span>
                  </Label>
                  <Switch
                    id="auto-save"
                    checked={generalSettings.autoSave}
                    onCheckedChange={() => handleGeneralSettingChange('autoSave')}
                  />
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Label htmlFor="notifications" className="flex flex-col">
                    <span>Notificaciones</span>
                    <span className="text-sm text-muted-foreground">
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

        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Visualización</CardTitle>
              <CardDescription>
                Personaliza cómo se muestra la información en la aplicación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="attendance-history" className="flex flex-col">
                  <span>Mostrar Historial de Asistencia</span>
                  <span className="text-sm text-muted-foreground">
                    Muestra el historial de asistencia en la página de alumnos.
                  </span>
                </Label>
                <Switch
                  id="attendance-history"
                  checked={displaySettings.showAttendanceHistory}
                  onCheckedChange={() => handleDisplaySettingChange('showAttendanceHistory')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="compact-view" className="flex flex-col">
                  <span>Vista Compacta</span>
                  <span className="text-sm text-muted-foreground">
                    Muestra más información en menos espacio.
                  </span>
                </Label>
                <Switch
                  id="compact-view"
                  checked={displaySettings.compactView}
                  onCheckedChange={() => handleDisplaySettingChange('compactView')}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="profile-images" className="flex flex-col">
                  <span>Mostrar Imágenes de Perfil</span>
                  <span className="text-sm text-muted-foreground">
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

        <TabsContent value="notifications">
          <FcmDebug />
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-6 w-6" />
                Vinculación de WhatsApp
              </CardTitle>
              <CardDescription>
                Vincula tu dispositivo mediante código QR para automatizar el envío de mensajes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-green-500 animate-pulse' :
                      whatsappInfo.status === 'qr' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  <div>
                    <p className="font-medium">
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
                <div className="flex gap-2">
                  {whatsappInfo.status === 'disconnected' && (
                    <Button onClick={handleConnectWhatsapp} disabled={isConnectingWhatsapp}>
                      {isConnectingWhatsapp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Vincular
                    </Button>
                  )}
                  {whatsappInfo.status !== 'disconnected' && (
                    <Button variant="outline" onClick={handleDisconnectWhatsapp} className="text-destructive border-destructive">
                      <X className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>

              {whatsappInfo.status === 'qr' && whatsappInfo.qr && (
                <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-white">
                  <p className="mb-4 text-sm font-medium text-black">Escanee el código QR con su aplicación de WhatsApp</p>
                  <img src={whatsappInfo.qr} alt="WhatsApp QR" className="w-64 h-64" />
                  <p className="mt-4 text-xs text-muted-foreground text-center">
                    Vaya a Configuración &gt; Dispositivos vinculados &gt; Vincular un dispositivo
                  </p>
                </div>
              )}

              {whatsappInfo.status === 'connected' && (
                <div className="space-y-4 border p-4 rounded-lg">
                  <h3 className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Prueba de Envío
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="test-phone">Número de Teléfono</Label>
                      <Input
                        id="test-phone"
                        placeholder="Ej: 54911..."
                        value={testPhoneNumber}
                        onChange={(e) => setTestPhoneNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="test-msg">Mensaje</Label>
                      <Input
                        id="test-msg"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSendTestMessage}
                    disabled={isSendingTest}
                  >
                    {isSendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Enviar Mensaje de Prueba"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Sistema</CardTitle>
              <CardDescription>
                Ajustes avanzados del sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Backup y Restauración</h3>
                <p className="text-sm text-muted-foreground">
                  Gestiona la copia de seguridad y restauración de datos.
                </p>
                <div className="flex space-x-2 mt-2">
                  <Button variant="outline">Generar Backup</Button>
                  <Button variant="outline">Restaurar Datos</Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Borrar Datos</h3>
                <p className="text-sm text-muted-foreground">
                  Elimina datos del sistema. Esta acción no se puede deshacer.
                </p>
                <div className="flex space-x-2 mt-2">
                  <Button variant="destructive">Borrar Cache</Button>
                  <Button variant="destructive">Resetear Configuración</Button>
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

