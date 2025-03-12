
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Configuration() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [generalSettings, setGeneralSettings] = useState({
    darkMode: false,
    autoSave: true,
    notifications: true,
  });
  
  const [displaySettings, setDisplaySettings] = useState({
    showAttendanceHistory: true,
    compactView: false,
    showProfileImages: true,
  });

  const handleGeneralSettingChange = (setting: keyof typeof generalSettings) => {
    setGeneralSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleDisplaySettingChange = (setting: keyof typeof displaySettings) => {
    setDisplaySettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSaveSettings = () => {
    // Here you would save the settings to a database or localStorage
    // For now, we'll just show a toast notification
    toast({
      title: "Configuración guardada",
      description: "Los cambios han sido aplicados exitosamente",
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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Configuración</h1>
      
      <Tabs defaultValue="general">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="display">Visualización</TabsTrigger>
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
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="dark-mode" className="flex flex-col">
                  <span>Modo Oscuro</span>
                  <span className="text-sm text-muted-foreground">
                    Cambia la apariencia de la aplicación a un tema oscuro.
                  </span>
                </Label>
                <Switch 
                  id="dark-mode" 
                  checked={generalSettings.darkMode}
                  onCheckedChange={() => handleGeneralSettingChange('darkMode')}
                />
              </div>
              
              <div className="flex items-center justify-between">
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
              
              <div className="flex items-center justify-between">
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
    </div>
  );
}
