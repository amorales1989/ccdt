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
import { getCompany, updateCompany, getWhatsappStatus, connectWhatsapp, disconnectWhatsapp, testWhatsappMessage, runBirthdayCron, getMemberCount, getSubscription, renewSubscription, subscribe, getQuote, changePlan, changePacks, getMyPayments, SubscriptionQuote, Payment } from "@/lib/api";
import { planLabel, effectiveLimit, planLimit, PACK_SIZE } from "@/lib/plans";
import { Loader2, Moon, Sun, Upload, X, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Settings, FileText, LayoutGrid, Shield, Bell, KeyRound, Cake, Layers, Users, Infinity as InfinityIcon, Plus, Minus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase, STORAGE_URL } from "@/integrations/supabase/client";
import { FcmDebug } from "@/components/FcmDebug";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { isDemoMode } from "@/lib/demo";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { DEFAULT_PERMISSIONS } from "@/lib/rolePermissions";

// ─── Permisos y Notificaciones ───────────────────────────────────────────────

const ALL_ROLES = [
  'admin', 'director_general', 'director', 'vicedirector',
  'secretaria', 'secr.-calendario', 'lider', 'maestro',
  'conserje', 'colaborador', 'auxiliar_maestro',
] as const;

const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  manual: 'Pago manual',
  transferencia: 'Transferencia',
  mp_link: 'Pago único (MP)',
  mp_subscription: 'Débito automático (MP)',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', director_general: 'Director General', director: 'Director',
  vicedirector: 'Vicedirector', secretaria: 'Secretaria', 'secr.-calendario': 'Secr. Calendario',
  lider: 'Líder', maestro: 'Maestro', conserje: 'Conserje',
  colaborador: 'Colaborador', auxiliar_maestro: 'Auxiliar de maestro',
};

// Solo queda acá "Agregar miembros": es la única acción sin equivalente en
// Visibilidad de Menú. Tomar asistencia y Promover miembros ahora reusan
// menu_asistencia/menu_promover como guard de página (ver TomarAsistencia.tsx y
// PromoverAlumnos.tsx) para no tener dos switches del mismo concepto desincronizables.
// Editar miembros, ver informes, gestionar eventos y autorizaciones ya tenían su
// propio control de acceso hardcodeado/existente y funcionaba: no hacía falta otro switch.
const PERMISSIONS = [
  { key: 'puede_agregar_miembros', label: 'Agregar miembros' },
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
  { key: 'menu_registro_temas',   label: 'Registro de Temas' },
  { key: 'menu_informes',         label: 'Informes de Personal' },
  { key: 'menu_material',         label: 'Material Didáctico' },
  { key: 'menu_departamentos',    label: 'Departamentos' },
  { key: 'menu_grupos',           label: 'Grupos Pequeños' },
  { key: 'menu_contabilidad',     label: 'Contabilidad' },
  { key: 'menu_gestion_usuarios', label: 'Gestión de Usuarios' },
  { key: 'menu_configuracion',    label: 'Configuración' },
  { key: 'menu_mantenimiento',    label: 'Solicitar Reparación' },
  { key: 'menu_notificaciones',   label: 'Notificaciones' },
] as const;

const NOTIFICATION_EVENTS = [
  { key: 'cumpleanos', label: 'Cumpleaños de miembros', description: 'Notifica a los responsables cuando un miembro de su clase cumple años' },
  { key: 'solicitudes_pendientes', label: 'Solicitudes de eventos pendientes', description: 'Alerta diaria sobre solicitudes de calendario sin aprobar' },
  { key: 'eventos_aprobados', label: 'Eventos aprobados', description: 'Notifica a los roles seleccionados cuando una solicitud es aprobada. Los rechazos solo se notifican al solicitante.' },
  { key: 'mantenimiento', label: 'Solicitudes de mantenimiento', description: 'Notifica cuando se registra un nuevo pedido de mantenimiento' },
  { key: 'ausencias', label: 'Ausencias de alumnos', description: 'Notifica a los responsables cuando un alumno lleva 4 semanas consecutivas sin asistir a su clase' },
  { key: 'asistencia_no_tomada', label: 'Asistencia sin tomar', description: 'Notifica a los responsables cuando no se registró la asistencia de su clase el día que tuvo actividad' },
] as const;


const DEFAULT_NOTIFICATIONS: Record<string, string[]> = {
  cumpleanos: ['lider', 'maestro'],
  solicitudes_pendientes: ['secr.-calendario', 'admin'],
  eventos_aprobados: ['director', 'vicedirector'],
  mantenimiento: ['conserje', 'admin'],
  ausencias: ['lider', 'maestro'],
  asistencia_no_tomada: ['lider', 'maestro', 'auxiliar_maestro'],
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
  const [isRunningBirthdayCron, setIsRunningBirthdayCron] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_PERMISSIONS);
  const [notificationSettings, setNotificationSettings] = useState<Record<string, string[]>>(DEFAULT_NOTIFICATIONS);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [isSettingMasterPassword, setIsSettingMasterPassword] = useState(false);

  const [generalSettings, setGeneralSettings] = useState({
    darkMode: false,
    autoSave: true,
    notifications: true,
    showName: true,
    baptized: true,
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

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['member-count'],
    queryFn: getMemberCount,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    enabled: profile?.role === 'admin' || profile?.role === 'secretaria',
  });

  const { data: myPayments = [] } = useQuery({
    queryKey: ['my-payments'],
    queryFn: getMyPayments,
    enabled: profile?.role === 'admin' || profile?.role === 'secretaria',
  });

  const renewMutation = useMutation({
    mutationFn: (billing_cycle: 'mensual' | 'anual') => renewSubscription(billing_cycle),
    onSuccess: (data) => {
      window.open(data.init_point, '_blank', 'noopener,noreferrer');
    },
    onError: (error: any) => {
      toast({
        title: error?.message?.includes('no configurados') ? 'Pagos no disponibles' : 'Error',
        description: error?.message || 'No se pudo generar el link de pago',
        variant: "destructive",
      });
    },
  });

  // ─── Suscripción automática (débito) — opción principal (Paso 3) ────────
  const [subscribeCycle, setSubscribeCycle] = useState<'mensual' | 'anual'>('mensual');
  const subscribeMutation = useMutation({
    mutationFn: (billing_cycle: 'mensual' | 'anual') => subscribe(billing_cycle),
    onSuccess: (data) => {
      window.open(data.init_point, '_blank', 'noopener,noreferrer');
    },
    onError: (error: any) => {
      toast({
        title: error?.message?.includes('no configurados') ? 'Pagos no disponibles' : 'Error',
        description: error?.message || 'No se pudo iniciar la suscripción',
        variant: "destructive",
      });
    },
  });

  // Días que le quedan del ciclo actual, para explicar el prorrateo (mismo cálculo que
  // prorateFactor en subscriptionController.js: capado a la duración del ciclo).
  const cycleDaysRemaining = (() => {
    if (!subscription?.due_date) return null;
    const cycleDays = subscription.billing_cycle === 'anual' ? 365 : 30;
    const todayStr = new Date().toISOString().slice(0, 10);
    const days = Math.ceil((new Date(subscription.due_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(cycleDays, days));
  })();
  const prorateNote = cycleDaysRemaining != null
    ? `Se cobra la diferencia de precio prorrateada por los ${cycleDaysRemaining} día${cycleDaysRemaining === 1 ? '' : 's'} que te quedan hasta el ${new Date(subscription!.due_date!).toLocaleDateString('es-AR')} (próximo vencimiento). El resto del ciclo ya lo pagaste con el plan anterior.`
    : 'Se cobra la diferencia de precio prorrateada por los días que te quedan del ciclo actual.';

  // ─── Cambio de plan / packs (self-service, Paso 2) ───────────────────────
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [planQuote, setPlanQuote] = useState<SubscriptionQuote | null>(null);
  const [packsDelta, setPacksDelta] = useState(0);
  const [packsQuote, setPacksQuote] = useState<SubscriptionQuote | null>(null);

  useEffect(() => {
    if (subscription?.plan && !selectedPlan) setSelectedPlan(subscription.plan);
  }, [subscription?.plan]);

  useEffect(() => {
    if (!selectedPlan || selectedPlan === subscription?.plan) { setPlanQuote(null); return; }
    let active = true;
    getQuote({ type: 'plan', plan: selectedPlan })
      .then((q) => { if (active) setPlanQuote(q); })
      .catch((error: any) => {
        if (!active) return;
        setPlanQuote(null);
        toast({ title: 'No se puede cambiar de plan', description: error?.message, variant: "destructive" });
      });
    return () => { active = false; };
  }, [selectedPlan, subscription?.plan]);

  useEffect(() => {
    if (packsDelta === 0) { setPacksQuote(null); return; }
    let active = true;
    getQuote({ type: 'packs', delta: packsDelta })
      .then((q) => { if (active) setPacksQuote(q); })
      .catch((error: any) => {
        if (!active) return;
        setPacksQuote(null);
        toast({ title: 'No se puede cambiar la capacidad', description: error?.message, variant: "destructive" });
      });
    return () => { active = false; };
  }, [packsDelta]);

  const changePlanMutation = useMutation({
    mutationFn: (plan: string) => changePlan(plan),
    onSuccess: (data) => {
      if (data.mode === 'charge' && data.init_point) {
        window.open(data.init_point, '_blank', 'noopener,noreferrer');
        return;
      }
      toast({ title: "Cambio de plan programado", description: "Se aplicará al renovar el ciclo." });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'No se pudo cambiar el plan', variant: "destructive" });
    },
  });

  const changePacksMutation = useMutation({
    mutationFn: (delta: number) => changePacks(delta),
    onSuccess: (data) => {
      if (data.mode === 'charge' && data.init_point) {
        window.open(data.init_point, '_blank', 'noopener,noreferrer');
        return;
      }
      toast({ title: "Cambio de capacidad programado", description: "Se aplicará al renovar el ciclo." });
      setPacksDelta(0);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error?.message || 'No se pudo cambiar la capacidad', variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const subStatus = params.get('sub');
    if (!paymentStatus && !subStatus) return;
    if (paymentStatus === 'success') {
      toast({ title: "Pago recibido", description: "Se está acreditando en tu cuenta." });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['my-payments'] });
    } else if (paymentStatus === 'failure') {
      toast({ title: "Pago no completado", description: "El pago no se pudo procesar.", variant: "destructive" });
    }
    if (subStatus === 'success') {
      toast({ title: "Suscripción creada", description: "Se está activando el débito automático." });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    }
    params.delete('payment');
    params.delete('sub');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
  }, []);

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
      showName: company.show_name !== false,
      baptized: (company as any).baptized_enabled !== false
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
    if (isDemoMode()) {
      toast({ title: "Modo demo", description: "No se puede vincular WhatsApp en la demostración." });
      return;
    }
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
    if (isDemoMode()) {
      toast({ title: "Modo demo", description: "Acción no disponible en la demostración." });
      return;
    }
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
    if (isDemoMode()) {
      toast({ title: "Modo demo", description: "No se envían mensajes en la demostración." });
      return;
    }
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

  const handleRunBirthdayCron = async () => {
    if (isDemoMode()) {
      toast({ title: "Modo demo", description: "No se ejecuta el cron en la demostración." });
      return;
    }
    try {
      setIsRunningBirthdayCron(true);
      await runBirthdayCron(getPersistentCompanyId());
      toast({
        title: "Cron ejecutado",
        description: "La verificación de cumpleaños se ejecutó correctamente.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo ejecutar el cron de cumpleaños.",
        variant: "destructive",
      });
    } finally {
      setIsRunningBirthdayCron(false);
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
      showName: 'show_name',
      baptized: 'baptized_enabled'
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

  const handleSetMasterPassword = async () => {
    if (masterPassword !== confirmMasterPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    if (masterPassword.length < 8) {
      toast({ title: "Error", description: "La contraseña maestra debe tener al menos 8 caracteres.", variant: "destructive" });
      return;
    }
    setIsSettingMasterPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('master-login', {
        body: { action: 'set', password: masterPassword, companyId: getPersistentCompanyId() }
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setMasterPassword("");
      setConfirmMasterPassword("");
      toast({ title: "Contraseña maestra configurada", description: "La contraseña maestra fue guardada correctamente." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo guardar la contraseña maestra.", variant: "destructive" });
    } finally {
      setIsSettingMasterPassword(false);
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
          ...(getPersistentCompanyId() === 1 ? [] : [{ value: 'plan', label: 'Plan', icon: Layers }]),
          { value: 'authorizations', label: 'Membrete', icon: FileText },
          { value: 'whatsapp', label: 'Whatsapp', icon: Smartphone },
          ...(profile?.role === 'admin' ? [
            { value: 'permissions', label: 'Permisos', icon: Shield },
            { value: 'notifications', label: 'Notificaciones', icon: Bell },
            ...(isDemoMode() ? [] : [{ value: 'security', label: 'Seguridad', icon: KeyRound }]),
          ] : []),
        ]}
        scrollable
        className="mb-6 w-full md:w-fit"
      />

      <div className="space-y-6">
        {activeTab === 'plan' && (() => {
          const plan = (company as any)?.plan as string | null | undefined;
          const packs = (company as any)?.extra_member_packs || 0;
          const base = planLimit(plan);
          const effLimit = effectiveLimit(plan, packs);
          const unlimited = effLimit == null;
          const pct = unlimited ? 0 : Math.min(100, Math.round((memberCount / effLimit) * 100));
          const barColor = pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-indigo-500';
          // Facturación
          const plansList = subscription?.plans || [];
          const curPlanRow = plansList.find((p) => p.value === plan);
          const planPrice = curPlanRow?.price_monthly ?? 0;
          const packPrice = curPlanRow?.pack_price_monthly ?? 3000;
          const currentMonthly = planPrice + packs * packPrice;
          const selPlanRow = plansList.find((p) => p.value === (selectedPlan || plan));
          const projectedPlanPrice = selPlanRow?.price_monthly ?? planPrice;
          const projectedPackPrice = selPlanRow?.pack_price_monthly ?? packPrice;
          const projectedPacks = Math.max(0, packs + packsDelta);
          const projectedMonthly = projectedPlanPrice + projectedPacks * projectedPackPrice;
          const changed = (!!selectedPlan && selectedPlan !== plan) || packsDelta !== 0;
          const noPrice = planPrice <= 0 && unlimited;
          const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-AR');
          const canManage = profile?.role === 'admin' || profile?.role === 'secretaria';
          return (
            <div className="mt-0 outline-none">
              <div className="w-full">
                <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-indigo-500/5 overflow-hidden font-inter">
                  <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-100 dark:bg-indigo-900/40 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10">
                        <Layers className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Tu Plan</CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Características y uso de tu suscripción.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    {/* Plan actual */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan actual</span>
                      <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-black text-sm px-4 py-1.5 rounded-xl">
                        {planLabel(plan) || 'Sin plan asignado'}
                      </Badge>
                    </div>

                    {/* Capacidad de miembros */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> Miembros
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          {memberCount}
                          {unlimited
                            ? <span className="flex items-center gap-1 text-slate-400">/ <InfinityIcon className="h-4 w-4" /></span>
                            : <span className="text-slate-400">/ {effLimit}</span>}
                        </span>
                      </div>
                      {!unlimited && (
                        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {!unlimited && memberCount >= effLimit && (
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400">Alcanzaste el límite de tu plan. Contactá al administrador para ampliarlo o agregar packs.</p>
                      )}
                      {!unlimited && memberCount < effLimit && (
                        <p className="text-xs text-slate-400">Quedan {effLimit - memberCount} lugares disponibles.</p>
                      )}
                    </div>

                    {/* Detalle */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{base == null ? '∞' : base}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Límite base del plan</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{packs} <span className="text-sm font-bold text-slate-400">(+{packs * PACK_SIZE})</span></div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Packs extra (×{PACK_SIZE})</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                        <div className="text-2xl font-black text-slate-800 dark:text-white">{unlimited ? '∞' : effLimit}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Capacidad total</div>
                      </div>
                    </div>

                    {/* Detalle de facturación */}
                    <div className="border-t border-slate-200/60 dark:border-slate-800 pt-6 space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detalle de facturación</span>
                      {noPrice ? (
                        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                          Plan Corporativo — precio a convenir con el administrador.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 text-sm">
                              <span className="text-slate-500 dark:text-slate-400">Plan {planLabel(plan)}</span>
                              <span className="font-bold text-slate-800 dark:text-white">{fmt(planPrice)}/mes</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-slate-200/60 dark:border-slate-800">
                              <span className="text-slate-500 dark:text-slate-400">Packs: {packs} × {fmt(packPrice)}</span>
                              <span className="font-bold text-slate-800 dark:text-white">{fmt(packs * packPrice)}/mes</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                              <span className="text-sm font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">Total mensual</span>
                              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{fmt(currentMonthly)}</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-2 text-xs border-t border-slate-200/60 dark:border-slate-800">
                              <span className="text-slate-400">Total anual (2 meses gratis)</span>
                              <span className="font-bold text-slate-500 dark:text-slate-400">{fmt(currentMonthly * 10)}/año</span>
                            </div>
                          </div>
                          {changed ? (
                            <div className="rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-5 flex flex-col justify-center">
                              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Con los cambios seleccionados</span>
                              <p className="text-sm font-bold text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                                {planLabel(selectedPlan || plan)} + {projectedPacks} pack(s) → {(base == null ? '∞' : (selPlanRow?.member_limit ?? base)) } { selPlanRow?.member_limit != null ? `+ ${projectedPacks * PACK_SIZE} miembros` : ''}
                              </p>
                              <div className="mt-3 flex items-end justify-between">
                                <div>
                                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{fmt(projectedMonthly)}<span className="text-sm font-bold">/mes</span></div>
                                  <div className="text-xs text-indigo-500">{fmt(projectedMonthly * 10)}/año</div>
                                </div>
                                <div className="text-right text-xs font-bold">
                                  {projectedMonthly > currentMonthly ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">+{fmt(projectedMonthly - currentMonthly)}/mes</span>
                                  ) : projectedMonthly < currentMonthly ? (
                                    <span className="text-amber-600 dark:text-amber-400">{fmt(projectedMonthly - currentMonthly)}/mes</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-5 flex items-center justify-center text-center text-xs text-slate-400">
                              Modificá el plan o los packs abajo para ver el nuevo total acá.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Estado de suscripción */}
                    {(() => {
                      const dueDate = (company as any)?.due_date as string | null | undefined;
                      const lastPayment = (company as any)?.last_payment_date as string | null | undefined;
                      const billingCycle = (company as any)?.billing_cycle as string | null | undefined;
                      const todayStr = new Date().toISOString().slice(0, 10);
                      let subStatus: 'vencido' | 'por_vencer' | 'al_dia' | 'sin_registro' = 'sin_registro';
                      if (dueDate) {
                        if (dueDate < todayStr) subStatus = 'vencido';
                        else {
                          const daysLeft = Math.ceil((new Date(dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
                          subStatus = daysLeft <= 7 ? 'por_vencer' : 'al_dia';
                        }
                      }
                      const statusMeta: Record<typeof subStatus, { label: string; className: string }> = {
                        vencido: { label: 'Vencido', className: 'bg-red-600 hover:bg-red-600 text-white' },
                        por_vencer: { label: 'Por vencer', className: 'bg-amber-500 hover:bg-amber-500 text-white' },
                        al_dia: { label: 'Al día', className: 'bg-emerald-600 hover:bg-emerald-600 text-white' },
                        sin_registro: { label: 'Sin suscripción registrada', className: 'bg-slate-400 hover:bg-slate-400 text-white' },
                      };
                      const meta = statusMeta[subStatus];
                      return (
                        <div className="space-y-3 border-t border-slate-200/60 dark:border-slate-800 pt-6">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado de suscripción</span>
                            <Badge className={`font-black text-xs px-4 py-1.5 rounded-xl ${meta.className}`}>{meta.label}</Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                              <div className="text-sm font-black text-slate-800 dark:text-white">{dueDate ? new Date(dueDate).toLocaleDateString('es-AR') : '—'}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Próximo vencimiento</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                              <div className="text-sm font-black text-slate-800 dark:text-white">{lastPayment ? new Date(lastPayment).toLocaleDateString('es-AR') : '—'}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Último pago</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4">
                              <div className="text-sm font-black text-slate-800 dark:text-white">{billingCycle === 'anual' ? 'Anual' : 'Mensual'}</div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Ciclo</div>
                            </div>
                          </div>
                          {canManage && (
                            subscription?.subscription_status === 'authorized' ? (
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge className="font-black text-xs px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-600 text-white">
                                  Suscripción activa
                                </Badge>
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Débito automático activo</span>
                              </div>
                            ) : (
                              <div className="space-y-3 w-full">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Select value={subscribeCycle} onValueChange={(v) => setSubscribeCycle(v as 'mensual' | 'anual')}>
                                    <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 h-11 w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="mensual">Mensual</SelectItem>
                                      <SelectItem value="anual">Anual (2 meses gratis)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    className="button-gradient rounded-xl font-black h-11 px-6 shadow-lg shadow-primary/20"
                                    onClick={() => subscribeMutation.mutate(subscribeCycle)}
                                    disabled={subscribeMutation.isPending}
                                  >
                                    {subscribeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Suscribirme (débito automático)
                                  </Button>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-xs text-slate-400">¿Preferís pago único o transferencia?</span>
                                  <Button
                                    variant="outline"
                                    className="rounded-xl font-bold h-9 px-4"
                                    onClick={() => renewMutation.mutate(subscribeCycle)}
                                    disabled={renewMutation.isPending}
                                  >
                                    {renewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Renovar / Pagar
                                  </Button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })()}

                    {/* Cambios pendientes (downgrade/remove programados para el próximo ciclo) */}
                    {(subscription?.pending_plan || (subscription?.pending_extra_member_packs != null && subscription.pending_extra_member_packs !== packs)) && (
                      <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Cambios pendientes al renovar</span>
                        {subscription?.pending_plan && (
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Plan pendiente: {planLabel(subscription.pending_plan)}</p>
                        )}
                        {subscription?.pending_extra_member_packs != null && subscription.pending_extra_member_packs !== packs && (
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Packs pendientes: {subscription.pending_extra_member_packs}</p>
                        )}
                      </div>
                    )}

                    {canManage && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200/60 dark:border-slate-800 pt-6">
                        {/* Cambiar plan */}
                        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cambiar plan</span>
                          <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                            <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 h-11">
                              <SelectValue placeholder="Elegí un plan" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {(subscription?.plans || []).map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label} — ${p.price_monthly}/mes
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedPlan && selectedPlan !== plan && planQuote && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {planQuote.mode === 'charge'
                                  ? `Cargo prorrateado: $${planQuote.amount}`
                                  : planQuote.effect || 'Se aplica al renovar el ciclo'}
                              </p>
                              {planQuote.mode === 'charge' && (
                                <p className="text-[11px] text-slate-400 leading-snug">{prorateNote}</p>
                              )}
                              <Button
                                className="button-gradient rounded-xl font-black h-10 px-5 w-full"
                                onClick={() => changePlanMutation.mutate(selectedPlan)}
                                disabled={changePlanMutation.isPending}
                              >
                                {changePlanMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {planQuote.mode === 'charge' ? 'Pagar y cambiar' : 'Programar cambio'}
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Packs */}
                        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 p-4 space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Packs de miembros (×{PACK_SIZE})</span>
                          <div className="flex items-center justify-center gap-4">
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-xl h-10 w-10"
                              onClick={() => setPacksDelta((d) => d - 1)}
                              disabled={packs + packsDelta <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-lg font-black text-slate-800 dark:text-white w-10 text-center">{packs + packsDelta}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-xl h-10 w-10"
                              onClick={() => setPacksDelta((d) => d + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {packsDelta !== 0 && packsQuote && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                {packsQuote.mode === 'charge'
                                  ? `Cargo prorrateado: $${packsQuote.amount}`
                                  : packsQuote.effect || 'Se aplica al renovar el ciclo'}
                              </p>
                              {packsQuote.mode === 'charge' && (
                                <p className="text-[11px] text-slate-400 leading-snug">{prorateNote}</p>
                              )}
                              <Button
                                className="button-gradient rounded-xl font-black h-10 px-5 w-full"
                                onClick={() => changePacksMutation.mutate(packsDelta)}
                                disabled={changePacksMutation.isPending}
                              >
                                {changePacksMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {packsQuote.mode === 'charge' ? 'Pagar y agregar' : 'Programar'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Historial de pagos */}
                    <div className="border-t border-slate-200/60 dark:border-slate-800 pt-6 space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historial de pagos</span>
                      {myPayments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400">
                          Todavía no hay pagos registrados.
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden divide-y divide-slate-200/60 dark:divide-slate-800">
                          {myPayments.map((p: Payment) => {
                            const period = p.period_start && p.period_end
                              ? `${new Date(p.period_start).toLocaleDateString('es-AR')} → ${new Date(p.period_end).toLocaleDateString('es-AR')}`
                              : null;
                            const detail = [
                              PAYMENT_SOURCE_LABELS[p.source] || p.source,
                              p.billing_cycle === 'anual' ? 'Anual' : p.billing_cycle === 'mensual' ? 'Mensual' : null,
                              p.notes || null,
                            ].filter(Boolean).join(' · ');
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-800 dark:text-white">
                                    {new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </div>
                                  <div className="text-xs text-slate-400 truncate">{detail}{period ? ` · ${period}` : ''}</div>
                                </div>
                                <div className="text-sm font-black text-slate-800 dark:text-white whitespace-nowrap">
                                  ${Number(p.amount).toLocaleString('es-AR')}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 border-t border-slate-200/60 dark:border-slate-800 pt-4">
                      {canManage
                        ? 'Los downgrades y reducciones de packs se aplican al renovar el ciclo; nunca por debajo de tus miembros actuales.'
                        : 'Para cambiar de plan o sumar packs de miembros, contactá al administrador del sistema.'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}
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
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">Campo Bautizado</Label>
                          <p className="text-[10px] text-slate-500 font-medium tracking-tight">Mostrar el campo bautizado en miembros y perfiles</p>
                        </div>
                        <Switch
                          checked={generalSettings.baptized}
                          onCheckedChange={() => handleGeneralSettingChange('baptized')}
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

            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-purple-500/5 overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-pink-100 dark:bg-pink-900/30 p-2.5 rounded-xl text-pink-600 dark:text-pink-400 shadow-inner">
                    <Cake className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Cron de Cumpleaños</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">Ejecuta manualmente la verificación diaria de cumpleaños (normalmente 08:00 AM).</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8">
                <Button
                  className="w-full bg-gradient-to-r from-pink-600 to-rose-700 hover:from-pink-700 hover:to-rose-800 text-white shadow-xl shadow-pink-500/10 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest gap-2"
                  onClick={handleRunBirthdayCron}
                  disabled={isRunningBirthdayCron}
                >
                  {isRunningBirthdayCron ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cake className="h-3.5 w-3.5" />}
                  Ejecutar Ahora
                </Button>
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
                        <th rowSpan={2} className="sticky left-0 z-20 bg-white dark:bg-slate-900 text-left py-3 px-2 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[130px] align-bottom border-r border-slate-200 dark:border-slate-700">Rol</th>
                        <th colSpan={PERMISSIONS.length} className="text-center py-2 px-1 font-black text-[11px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800">Acciones</th>
                        <th colSpan={MENU_PERMISSIONS.length} className="text-center py-2 px-1 font-black text-[11px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 border-l border-slate-200 dark:border-slate-700">Visibilidad de Menú</th>
                      </tr>
                      <tr>
                        {PERMISSIONS.map(p => (
                          <th key={p.key} className="text-center py-3 px-1 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[90px]">
                            {p.label}
                          </th>
                        ))}
                        {MENU_PERMISSIONS.map((p, i) => (
                          <th key={p.key} className={`text-center py-3 px-1 font-black text-xs uppercase tracking-widest text-slate-400 min-w-[80px] ${i === 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}`}>
                            {p.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_ROLES.map((role, i) => (
                        <tr key={role} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                          <td className={`sticky left-0 z-10 py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 ${i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}`}>
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
                          {MENU_PERMISSIONS.map((p, j) => (
                            <td key={p.key} className={`py-3 px-1 text-center ${j === 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}`}>
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

        {/* ── TAB: Seguridad ──────────────────────────────────────────────── */}
        {activeTab === 'security' && !isDemoMode() && (
          <div className="mt-0 outline-none space-y-6">
            <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 border-b border-white/10 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-rose-100 dark:bg-rose-900/40 p-3 rounded-2xl text-rose-600 dark:text-rose-400">
                    <KeyRound className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Contraseña Maestra</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                      Permite al admin iniciar sesión con cualquier cuenta usando esta contraseña en lugar de la contraseña del usuario.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300">
                  La contraseña maestra no reemplaza ni modifica las contraseñas de los usuarios. Solo el rol <strong>admin</strong> puede configurarla.
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nueva contraseña maestra</Label>
                    <Input
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={masterPassword}
                      onChange={e => setMasterPassword(e.target.value)}
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar contraseña maestra</Label>
                    <Input
                      type="password"
                      placeholder="Repetir contraseña"
                      value={confirmMasterPassword}
                      onChange={e => setConfirmMasterPassword(e.target.value)}
                      className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                    />
                  </div>
                  <Button
                    onClick={handleSetMasterPassword}
                    disabled={isSettingMasterPassword || !masterPassword || !confirmMasterPassword}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold shadow-lg"
                  >
                    {isSettingMasterPassword ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                    ) : (
                      'Guardar Contraseña Maestra'
                    )}
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

