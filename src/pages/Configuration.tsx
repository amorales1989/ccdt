import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomTabs } from "@/components/CustomTabs";
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
import { Loader2, Moon, Sun, Upload, X, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Settings, FileText, LayoutGrid, Shield, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase, STORAGE_URL } from "@/integrations/supabase/client";
import { FcmDebug } from "@/components/FcmDebug";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";

// ─── Permisos y Notificaciones ───────────────────────────────────────────────

const ALL_ROLES = [
  'admin', 'director_general', 'director', 'vicedirector',
  'secretaria', 'secr.-calendario', 'lider', 'maestro',
  'conserje', 'colaborador', 'ayudante',
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', director_general: 'Director General', director: 'Director',
  vicedirector: 'Vicedirector', secretaria: 'Secretaria', 'secr.-calendario': 'Secr. Calendario',
  lider: 'Líder', maestro: 'Maestro', conserje: 'Conserje',
  colaborador: 'Colaborador', ayudante: 'Ayudante',
};

const PERMISSIONS = [
  { key: 'puede_agregar_miembros', label: 'Agregar miembros' },
  { key: 'puede_editar_miembros', label: 'Editar miembros' },
  { key: 'puede_tomar_asistencia', label: 'Tomar asistencia' },
  { key: 'puede_ver_informes', label: 'Ver informes' },
  { key: 'puede_gestionar_eventos', label: 'Gestionar eventos' },
  { key: 'puede_promover_miembros', label: 'Promover miembros' },
  { key: 'puede_autorizaciones', label: 'Autorizaciones salida' },
] as const;

// ⚠️ REGLA: cada vez que se agrega un ítem al menú en AppSidebar.tsx,
// agregar aquí la entrada correspondiente (key = mismo valor que MENU_KEY_MAP en AppSidebar)
// y agregar la clave a DEFAULT_PERMISSIONS con true/false por rol.
const MENU_PERMISSIONS = [
  { key: 'menu_todos_miembros',   label: 'Todos los Miembros' },
  { key: 'menu_lista_miembros',   label: 'Lista de Miembros' },
  { key: 'menu_asistencia',       label: 'Tomar Asistencia' },
  { key: 'menu_historial',        label: 'Historial' },
  { key: 'menu_promover',         label: 'Promover Miembros' },
  { key: 'menu_autorizaciones',   label: 'Autorizaciones' },
  { key: 'menu_estadisticas',     label: 'Estadísticas' },
  { key: 'menu_informes',         label: 'Informes de Personal' },
  { key: 'menu_material',         label: 'Material Didáctico' },
  { key: 'menu_departamentos',    label: 'Departamentos' },
  { key: 'menu_gestion_usuarios', label: 'Gestión de Usuarios' },
  { key: 'menu_configuracion',    label: 'Configuración' },
  { key: 'menu_mantenimiento',    label: 'Solicitar Reparación' },
] as const;

const NOTIFICATION_EVENTS = [
  { key: 'cumpleanos', label: 'Cumpleaños de miembros', description: 'Notifica a los responsables cuando un miembro de su clase cumple años' },
  { key: 'solicitudes_pendientes', label: 'Solicitudes de eventos pendientes', description: 'Alerta diaria sobre solicitudes de calendario sin aprobar' },
  { key: 'eventos_aprobados', label: 'Eventos aprobados', description: 'Notifica a los roles seleccionados cuando una solicitud es aprobada. Los rechazos solo se notifican al solicitante.' },
  { key: 'mantenimiento', label: 'Solicitudes de mantenimiento', description: 'Notifica cuando se registra un nuevo pedido de mantenimiento' },
] as const;

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  admin:             { puede_agregar_miembros: true,  puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: true,  puede_gestionar_eventos: true,  puede_promover_miembros: true,  puede_autorizaciones: true,  menu_todos_miembros: true,  menu_lista_miembros: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: true,  menu_informes: true,  menu_material: true,  menu_departamentos: true,  menu_gestion_usuarios: true,  menu_configuracion: true,  menu_mantenimiento: true  },
  director_general:  { puede_agregar_miembros: false, puede_editar_miembros: true,  puede_tomar_asistencia: false, puede_ver_informes: true,  puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: true,  menu_departamentos: false, menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true  },
  director:          { puede_agregar_miembros: true,  puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: true,  puede_gestionar_eventos: false, puede_promover_miembros: true,  puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: false, menu_departamentos: false, menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true  },
  vicedirector:      { puede_agregar_miembros: true,  puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: true,  puede_gestionar_eventos: false, puede_promover_miembros: true,  puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: true,  menu_informes: true,  menu_material: false, menu_departamentos: false, menu_gestion_usuarios: true,  menu_configuracion: false, menu_mantenimiento: true  },
  secretaria:        { puede_agregar_miembros: true,  puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: true,  puede_gestionar_eventos: true,  puede_promover_miembros: true,  puede_autorizaciones: true,  menu_todos_miembros: true,  menu_lista_miembros: true,  menu_asistencia: false, menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: true,  menu_informes: false, menu_material: true,  menu_departamentos: true,  menu_gestion_usuarios: true,  menu_configuracion: true,  menu_mantenimiento: true  },
  'secr.-calendario':{ puede_agregar_miembros: false, puede_editar_miembros: false, puede_tomar_asistencia: false, puede_ver_informes: false, puede_gestionar_eventos: true,  puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: false, menu_asistencia: false, menu_historial: false, menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
  lider:             { puede_agregar_miembros: false, puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: false, puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: true,  menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: true,  menu_estadisticas: false, menu_informes: false, menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
  maestro:           { puede_agregar_miembros: false, puede_editar_miembros: true,  puede_tomar_asistencia: true,  puede_ver_informes: false, puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: true,  menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
  conserje:          { puede_agregar_miembros: false, puede_editar_miembros: false, puede_tomar_asistencia: false, puede_ver_informes: false, puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: false, menu_asistencia: false, menu_historial: false, menu_promover: false, menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
  colaborador:       { puede_agregar_miembros: false, puede_editar_miembros: false, puede_tomar_asistencia: false, puede_ver_informes: false, puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
  ayudante:          { puede_agregar_miembros: false, puede_editar_miembros: false, puede_tomar_asistencia: false, puede_ver_informes: false, puede_gestionar_eventos: false, puede_promover_miembros: false, puede_autorizaciones: false, menu_todos_miembros: false, menu_lista_miembros: true,  menu_asistencia: true,  menu_historial: true,  menu_promover: true,  menu_autorizaciones: false, menu_estadisticas: false, menu_informes: false, menu_material: false, menu_departamentos: false, menu_gestion_usuarios: false, menu_configuracion: false, menu_mantenimiento: true  },
};

const DEFAULT_NOTIFICATIONS: Record<string, string[]> = {
  cumpleanos: ['lider', 'maestro'],
  solicitudes_pendientes: ['secr.-calendario', 'admin'],
  eventos_aprobados: ['director', 'vicedirector'],
  mantenimiento: ['conserje', 'admin'],
};

// ─────────────────────────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState("general");
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_PERMISSIONS);
  const [notificationSettings, setNotificationSettings] = useState<Record<string, string[]>>(DEFAULT_NOTIFICATIONS);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const [generalSettings, setGeneralSettings] = useState({
    darkMode: false,
    autoSave: true,
    notifications: true,
    showName: true,
  });

  const [authPdfHeader, setAuthPdfHeader] = useState<{ text: string, enabled: boolean }[]>([
    { text: "Asociación de Beneficencia y Educación RHEMA", enabled: true },
    { text: "Personería Jurídica N° 23.212 (Leg. 111.169 – D.P.P.J.)", enabled: true },
    { text: "Libertad 3248, El Talar, Pdo. de Tigre, Pcia. Bs. As.", enabled: true },
    { text: "C.U.I.T. N° 30-70792033-1", enabled: true }
  ]);

  const { data: company, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId())
  });

  const { mutate: updateCompanyMutate } = useMutation({
    mutationFn: (updates: any) => updateCompany(getPersistentCompanyId(), updates),
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

    const companyData = company as any;
    if (companyData.auth_pdf_header && Array.isArray(companyData.auth_pdf_header) && companyData.auth_pdf_header.length > 0) {
      setAuthPdfHeader(companyData.auth_pdf_header as { text: string, enabled: boolean }[]);
    } else {
      setAuthPdfHeader([
        { text: "", enabled: false },
        { text: "", enabled: false },
        { text: "", enabled: false },
        { text: "", enabled: false }
      ]);
    }

    if (companyData.role_permissions && Object.keys(companyData.role_permissions).length > 0) {
      const merged = { ...DEFAULT_PERMISSIONS };
      for (const role of Object.keys(companyData.role_permissions)) {
        merged[role] = { ...DEFAULT_PERMISSIONS[role], ...companyData.role_permissions[role] };
      }
      setRolePermissions(merged);
    }
    if (companyData.notification_settings && Object.keys(companyData.notification_settings).length > 0) {
      setNotificationSettings({ ...DEFAULT_NOTIFICATIONS, ...companyData.notification_settings });
    }
  }, [company]);

  // Polling para el estado de WhatsApp
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getWhatsappStatus(getPersistentCompanyId());
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
      await connectWhatsapp(getPersistentCompanyId());
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
      await disconnectWhatsapp(getPersistentCompanyId());
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
      await testWhatsappMessage(getPersistentCompanyId(), testPhoneNumber, testMessage);
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

  const handleAuthPdfHeaderChange = (index: number, field: 'text' | 'enabled', value: string | boolean) => {
    setAuthPdfHeader(prev => {
      const newHeader = [...prev];
      newHeader[index] = { ...newHeader[index], [field]: value };
      return newHeader;
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
        congregation_name: congregationName,
        auth_pdf_header: authPdfHeader
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
    toast({ title: "Nombre eliminado", description: "El nombre de la congregación ha sido eliminado" });
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
      await updateCompany(getPersistentCompanyId(), { role_permissions: rolePermissions });
      toast({ title: "Permisos guardados", description: "La configuración de roles fue actualizada." });
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los permisos.", variant: "destructive" });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      await updateCompany(getPersistentCompanyId(), { notification_settings: notificationSettings });
      toast({ title: "Notificaciones guardadas", description: "La configuración de notificaciones fue actualizada." });
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar las notificaciones.", variant: "destructive" });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const togglePermission = (role: string, perm: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role]?.[perm] }
    }));
  };

  const toggleNotificationRole = (event: string, role: string) => {
    setNotificationSettings(prev => {
      const current = prev[event] || [];
      return {
        ...prev,
        [event]: current.includes(role) ? current.filter(r => r !== role) : [...current, role]
      };
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
    return <LoadingOverlay message="Cargando configuración..." />;
  }
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 md:p-8 pb-32 animate-fade-in max-w-[1600px] mx-auto">
      <div className="relative group mb-8">
        <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-[3rem] -z-10 group-hover:bg-indigo-500/10 transition-all duration-700"></div>
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-indigo-500/5 overflow-hidden">
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center p-3.5 shadow-xl shadow-indigo-500/40 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Settings className="h-full w-full text-white" />
                </div>
              </div>
              <div className="space-y-0.5">
                <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                  Configuración
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                  Personalización y Ajustes Globales
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleSaveSettings}
                className="button-gradient rounded-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <CustomTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'general', label: 'Marca', icon: LayoutGrid },
          { value: 'authorizations', label: 'Membrete', icon: FileText },
          { value: 'whatsapp', label: 'Whatsapp', icon: Smartphone },
          ...(profile?.role === 'admin' ? [
            { value: 'permissions', label: 'Permisos', icon: Shield },
            { value: 'notifications', label: 'Notificaciones', icon: Bell },
          ] : []),
        ]}
        className="mb-6 w-full md:w-fit"
      />

      <div className="space-y-6">
        {activeTab === 'general' && (
          <div className="mt-0 outline-none space-y-6">
            <div className="w-full max-w-4xl mx-auto">
              <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-indigo-500/5 overflow-hidden font-inter">
                <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10">
                      <LayoutGrid className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Identidad de Marca</CardTitle>
                      <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Define el nombre y logo principal de la congregación.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2 group">
                        <Label htmlFor="companyName" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 group-focus-within:text-indigo-500">Nombre de la Congregación</Label>
                        <Input
                          id="companyName"
                          value={congregationName}
                          onChange={(e) => setCongregationName(e.target.value)}
                          className="h-11 rounded-xl bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-700 dark:text-slate-200"
                          placeholder="Ej: Congregación Los Pinos"
                        />
                      </div>

                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Logotipo Institucional</Label>
                        <div className="flex flex-col gap-3">
                          <Input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="h-10 rounded-xl bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 file:bg-indigo-600 file:text-white file:font-black file:uppercase file:text-[9px] file:tracking-widest file:rounded-lg file:px-3 file:h-6 file:mt-1 cursor-pointer text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={handleUploadLogo}
                              disabled={!logoFile || isUploading}
                              className="flex-1 button-gradient h-10 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                            >
                              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                              Actualizar Logo
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleShowImagePreview(logoPreview || '')}
                              disabled={!logoPreview}
                              className="h-10 px-4 rounded-xl border-slate-200 font-bold"
                            >
                              <Sun className="h-4 w-4 text-amber-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-center p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 shadow-inner group/logo relative overflow-hidden flex-1 min-h-[200px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/logo:opacity-100 transition-opacity duration-700"></div>
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Logo Preview"
                            className="max-h-32 w-auto object-contain drop-shadow-2xl cursor-pointer hover:scale-110 transition-transform duration-500 relative z-10"
                            onClick={() => handleShowImagePreview(logoPreview)}
                          />
                        ) : (
                          <div className="h-24 w-24 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-300 relative z-10">
                            <Upload className="h-8 w-8 opacity-20" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 dark:border-slate-800/50 space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ajustes de Interfaz</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">Mostrar nombre y logo</Label>
                          <p className="text-[10px] text-slate-500 font-medium tracking-tight">Hacer visible la marca en el menú lateral</p>
                        </div>
                        <Switch
                          checked={generalSettings.showName}
                          onCheckedChange={() => handleGeneralSettingChange('showName')}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">Notificaciones</Label>
                          <p className="text-[10px] text-slate-500 font-medium tracking-tight">Activar avisos y alertas del sistema</p>
                        </div>
                        <Switch
                          checked={generalSettings.notifications}
                          onCheckedChange={() => handleGeneralSettingChange('notifications')}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>


            </div>
          </div>
        )}

        {activeTab === 'authorizations' && (
          <div className="mt-0 outline-none">
            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-purple-500/5 overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">PDF de Autorizaciones</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Personaliza el encabezado legal de los documentos.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-4">
                <div className="grid gap-3">
                  {authPdfHeader.map((line, index) => {
                    const placeholders = [
                      "Ej: Asociación Civil Los Pinos",
                      "Ej: Personería Jurídica N°...",
                      "Ej: Calle 1234, Localidad, Provincia",
                      "Ej: C.U.I.T. N° 30-xxxxxxxx-x"
                    ];
                    return (
                      <div key={index} className="group relative flex flex-col md:flex-row items-center gap-4 p-4 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 transition-all duration-300 shadow-sm">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-400 font-black text-[10px] shrink-0 border border-slate-200 dark:border-slate-800">
                          {index + 1}
                        </div>

                        <div className="flex-1 w-full space-y-1">
                          <Label htmlFor={`auth-line-${index}`} className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Línea de encabezado</Label>
                          <Input
                            id={`auth-line-${index}`}
                            value={line.text}
                            onChange={(e) => handleAuthPdfHeaderChange(index, 'text', e.target.value)}
                            className="h-10 rounded-xl bg-transparent border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 transition-all px-3 text-sm"
                            placeholder={placeholders[index] || `Texto para la línea ${index + 1}`}
                          />
                        </div>

                        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 self-end md:self-center">
                          <Label htmlFor={`auth-enable-${index}`} className="text-[9px] font-black uppercase tracking-widest text-slate-400 cursor-pointer">Activa</Label>
                          <Switch
                            id={`auth-enable-${index}`}
                            checked={line.enabled}
                            onCheckedChange={(checked) => handleAuthPdfHeaderChange(index, 'enabled', checked)}
                            className="scale-90 data-[state=checked]:bg-indigo-600"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex gap-3 mt-2">
                  <div className="p-1.5 bg-indigo-500/20 rounded-lg h-fit">
                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">
                    Estas líneas aparecerán en el orden indicado en la parte superior derecha de los certificados de inscripción. Recomendamos mantener la información legal actualizada.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="mt-0 outline-none space-y-6">
            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-purple-500/5 overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-xl text-green-600 dark:text-green-400 shadow-inner">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Conexión WhatsApp</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Vincular cuenta para automatizar notificaciones.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className={`p-6 rounded-3xl border transition-all duration-500 flex flex-col md:flex-row items-center justify-between gap-6 ${whatsappInfo.status === 'connected'
                  ? 'bg-green-500/5 border-green-500/20 shadow-xl shadow-green-500/5'
                  : whatsappInfo.status === 'qr'
                    ? 'bg-amber-500/5 border-amber-500/20 shadow-xl shadow-amber-500/5'
                    : 'bg-red-500/5 border-red-500/20 shadow-xl shadow-red-500/5'
                  }`}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`absolute inset-0 blur-xl rounded-full opacity-30 ${whatsappInfo.status === 'connected' ? 'bg-green-500' : whatsappInfo.status === 'qr' ? 'bg-amber-500' : 'bg-red-500'
                        }`}></div>
                      <div className={`relative h-14 w-14 rounded-2xl flex items-center justify-center p-3.5 shadow-2xl ${whatsappInfo.status === 'connected' ? 'bg-green-500 text-white' : whatsappInfo.status === 'qr' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                        {whatsappInfo.status === 'connected' ? <CheckCircle2 className="h-full w-full" /> : <Smartphone className="h-full w-full" />}
                      </div>
                    </div>

                    <div className="space-y-0.5 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800 dark:text-white">
                          {whatsappInfo.status === 'connected' ? 'Servicio Activo' : whatsappInfo.status === 'qr' ? 'Esperando QR' : 'Desconectado'}
                        </h3>
                        <div className={`h-1.5 w-1.5 rounded-full ${whatsappInfo.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {whatsappInfo.status === 'connected' ? 'Instancia enviando correctamente.' : 'Vincule su dispositivo para comenzar.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full md:w-auto">
                    {whatsappInfo.status === 'disconnected' && (
                      <Button
                        onClick={handleConnectWhatsapp}
                        disabled={isConnectingWhatsapp}
                        className="flex-1 md:flex-none button-gradient rounded-xl h-11 px-6 font-black uppercase text-[10px] tracking-widest gap-2"
                      >
                        {isConnectingWhatsapp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Vincular Ahora
                      </Button>
                    )}
                    {whatsappInfo.status !== 'disconnected' && (
                      <Button
                        variant="outline"
                        onClick={handleDisconnectWhatsapp}
                        className="flex-1 md:flex-none rounded-xl h-11 px-6 border-red-200 dark:border-red-900/50 text-red-500 font-black uppercase text-[9px] tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Desconectar
                      </Button>
                    )}
                  </div>
                </div>

                {whatsappInfo.status === 'qr' && whatsappInfo.qr && (
                  <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-inner relative overflow-hidden group">
                    <div className="relative z-10 space-y-6 flex flex-col items-center">
                      <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 ring-4 ring-slate-50 dark:ring-slate-900/50">
                        <img src={whatsappInfo.qr} alt="WhatsApp QR" className="w-48 h-48 mix-blend-multiply transition-transform duration-500 hover:scale-105" />
                      </div>
                      <div className="space-y-1 text-center max-w-xs">
                        <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tighter">Escanea el código</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {whatsappInfo.status === 'connected' && (
                  <div className="space-y-6 p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-6 bg-green-500 rounded-full"></div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Prueba de Integración</h3>
                      </div>
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[8px] font-black uppercase tracking-widest border-none">Live</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <Label htmlFor="test-phone" className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Teléfono de Prueba</Label>
                        <Input
                          id="test-phone"
                          placeholder="Ej: 54911..."
                          value={testPhoneNumber}
                          onChange={(e) => setTestPhoneNumber(e.target.value)}
                          className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-4 text-sm font-medium shadow-inner"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="test-msg" className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Mensaje personalizado</Label>
                        <Input
                          id="test-msg"
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          className="h-11 rounded-xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 px-4 text-sm font-medium shadow-inner"
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white shadow-xl shadow-green-500/10 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest gap-2"
                      onClick={handleSendTestMessage}
                      disabled={isSendingTest}
                    >
                      {isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Enviar Mensaje de Prueba
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {/* ── TAB: Permisos por Rol ───────────────────────────────────────── */}
        {activeTab === 'permissions' && (
          <div className="mt-0 outline-none space-y-6">
            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Permisos por Rol</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Configurá qué puede hacer cada rol dentro de la app.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-3 px-2 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[130px]">Rol</th>
                        {PERMISSIONS.map(p => (
                          <th key={p.key} className="text-center py-3 px-1 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[90px]">
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_ROLES.map((role, i) => (
                        <tr key={role} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                          <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {ROLE_LABELS[role]}
                          </td>
                          {PERMISSIONS.map(p => (
                            <td key={p.key} className="py-3 px-1 text-center">
                              <Switch
                                checked={!!rolePermissions[role]?.[p.key]}
                                onCheckedChange={() => togglePermission(role, p.key)}
                                className="data-[state=checked]:bg-indigo-500"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h3 className="font-black text-slate-700 dark:text-slate-200 text-sm uppercase tracking-widest mb-4">Visibilidad de Menú</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-3 px-2 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[130px]">Rol</th>
                          {MENU_PERMISSIONS.map(p => (
                            <th key={p.key} className="text-center py-3 px-1 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[80px]">
                              {p.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_ROLES.map((role, i) => (
                          <tr key={role} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                            <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {ROLE_LABELS[role]}
                            </td>
                            {MENU_PERMISSIONS.map(p => (
                              <td key={p.key} className="py-3 px-1 text-center">
                                <Switch
                                  checked={!!rolePermissions[role]?.[p.key]}
                                  onCheckedChange={() => togglePermission(role, p.key)}
                                  className="data-[state=checked]:bg-indigo-500"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleSavePermissions}
                    disabled={isSavingPermissions}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl px-8 font-bold shadow-lg"
                  >
                    {isSavingPermissions ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Permisos'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB: Notificaciones Automáticas ─────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="mt-0 outline-none space-y-6">
            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-2xl text-amber-600 dark:text-amber-400">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Notificaciones Automáticas</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Elegí qué roles reciben cada tipo de notificación automática.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-8">
                {NOTIFICATION_EVENTS.map(event => (
                  <div key={event.key} className="space-y-4">
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-base">{event.label}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{event.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {ALL_ROLES.map(role => {
                        const active = (notificationSettings[event.key] || []).includes(role);
                        return (
                          <button
                            key={role}
                            onClick={() => toggleNotificationRole(event.key, role)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                              active
                                ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-300'
                            }`}
                          >
                            {ROLE_LABELS[role]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={isSavingNotifications}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl px-8 font-bold shadow-lg"
                  >
                    {isSavingNotifications ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Notificaciones'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {showImagePreview && (
        <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
          <DialogContent className="sm:max-w-xl rounded-[2.5rem] bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-purple-100 dark:border-slate-800 shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-8 pb-0">
              <div className="flex items-center gap-4">
                <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-2xl text-amber-600 dark:text-amber-400">
                  <Sun className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Vista Previa del Logo</DialogTitle>
                  <DialogDescription className="text-slate-500">Visualización a tamaño completo de la identidad de marca.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="p-8 flex justify-center bg-slate-50/50 dark:bg-slate-900/30 m-6 rounded-[2rem] border border-slate-100 dark:border-slate-800/50 shadow-inner">
              <img
                src={previewImage}
                alt="Logo Preview"
                className="max-h-[60vh] w-auto object-contain drop-shadow-2xl"
              />
            </div>
            <div className="p-6 pt-0 flex justify-center">
              <Button
                onClick={() => setShowImagePreview(false)}
                className="button-gradient rounded-2xl h-12 px-10 font-black uppercase text-xs tracking-widest"
              >
                Cerrar Vista Previa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

