import React, { useState, useEffect, useMemo, useContext, createContext } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenu,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, ClipboardList, History, Home, Menu,
  FileText, LogOut, UserPlus2, UserRound, FolderIcon,
  FolderUp, Settings, FileOutput, ClipboardCheck, ChevronRight, Sun, Moon,
  BarChart3, BookOpen, Wrench, Megaphone, HelpCircle, Wallet, Building, Users2
} from "lucide-react";

// Icono de anclar/colapsar sidebar (panel con flecha). Hereda color con currentColor.
const HideSidebarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M20,24H4c-2.2,0-4-1.8-4-4V4c0-2.2,1.8-4,4-4h16c2.2,0,4,1.8,4,4v16C24,22.2,22.2,24,20,24z M4,2C2.9,2,2,2.9,2,4v16c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V4c0-1.1-0.9-2-2-2H4z"/>
    <path d="M8,24c-0.6,0-1-0.4-1-1V1c0-0.6,0.4-1,1-1s1,0.4,1,1v22C9,23.6,8.6,24,8,24z"/>
    <path d="M14,13c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l3-3c0.4-0.4,1-0.4,1.4,0s0.4,1,0,1.4l-3,3C14.5,12.9,14.3,13,14,13z"/>
    <path d="M17,16c-0.3,0-0.5-0.1-0.7-0.3l-3-3c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l3,3c0.4,0.4,0.4,1,0,1.4C17.5,15.9,17.3,16,17,16z"/>
  </svg>
);
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { getUnreadStaffReportsCount, getSmallGroups } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STORAGE_URL } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileEditor } from "@/components/ProfileEditor";
import { RoleSwitcher } from "./RoleSwitcher";
import { NotificationBell } from "./NotificationBell";
import { DEFAULT_PERMISSIONS } from "@/lib/rolePermissions";

// Contexto para el modo rail (solo desktop). En mobile/sheet queda con los defaults
// (collapsed=false, pinnable=false) y todo se renderiza como siempre.
interface SidebarCollapseCtx {
  collapsed: boolean;
  pinnable: boolean;
  pinned: boolean;
  togglePin: () => void;
}
const SidebarCollapseContext = createContext<SidebarCollapseCtx>({
  collapsed: false,
  pinnable: false,
  pinned: true,
  togglePin: () => {},
});

const getItems = (role: string | undefined, profile: any, unreadReportsCount: number = 0) => {
  const selectedDepartment = localStorage.getItem('selectedDepartment');
  if (selectedDepartment === 'calendario' || profile?.departments?.[0] === 'calendario') {
    return [
      { title: "Inicio", url: "/", icon: Home },
      { title: "Calendario", url: "/calendario", icon: FileText }
    ] as { title: string; url: string; icon: any; subItems?: { title: string; url: string }[]; badge?: number }[];
  }

  if (role === 'conserje') {
    return [
      { title: "Inicio", url: "/", icon: Home },
      { title: "Calendario", url: "/calendario", icon: FileText },
      { title: "Mantenimiento", url: "/mantenimiento", icon: Wrench }
    ] as { title: string; url: string; icon: any; subItems?: { title: string; url: string }[]; badge?: number }[];
  }

  if (role === 'system_admin') {
    return [
      { title: "Empresas", url: "/admin-sistema", icon: Building }
    ] as { title: string; url: string; icon: any; subItems?: { title: string; url: string }[]; badge?: number }[];
  }

  const userDepartment = profile?.departments?.[0] || selectedDepartment;

  // Full list — permissions system controls visibility via MENU_KEY_MAP filter
  const allItems: { title: string; url: string; icon: any; subItems?: { title: string; url: string }[]; badge?: number }[] = [
    { title: "Inicio", url: "/", icon: Home },
    { title: "Todos los Miembros", url: "/todos-los-miembros", icon: Users },
    { title: "Lista de Miembros", url: "/listar", icon: Users },
    { title: "Calendario", url: "/calendario", icon: FileText },
    { title: "Material Didáctico", url: "/material", icon: BookOpen },
    { title: "Informes de Personal", url: "/informes", icon: Users, badge: unreadReportsCount > 0 ? unreadReportsCount : undefined },
    { title: "Tomar Asistencia", url: "/asistencia", icon: ClipboardList },
    // Autorizaciones: only include if role is not lider, or lider in adolescentes
    ...(role !== "lider" || userDepartment === "adolescentes"
      ? [{ title: "Autorizaciones", url: "/autorizaciones", icon: FileOutput }]
      : []),
    { title: "Promover Miembros", url: "/promover", icon: FolderUp },
    { title: "Historial", url: "/historial", icon: History },
    { title: "Estadísticas", url: "/estadisticas", icon: BarChart3 },
    { title: "Registro de Temas", url: "/registro-temas", icon: ClipboardCheck },
    { title: "Departamentos", url: "/departamentos", icon: FolderIcon },
    { title: "Grupos Pequeños", url: "/grupos", icon: Users2 },
    { title: "Contabilidad", url: "/contabilidad", icon: Wallet },
    { title: "Gestión de Usuarios", url: "/gestion-usuarios", icon: UserRound },
    { title: "Notificaciones", url: "/notificaciones", icon: Megaphone },
  ];

  return allItems;
};

// Agrupación del menú en desplegables. Los ítems que no caen en ningún grupo (Inicio, Calendario,
// y los de roles especiales como Mantenimiento/Empresas) quedan sueltos. Un grupo se oculta solo
// si no le queda ningún hijo visible según los permisos del rol.
const TOP_LEVEL_ORDER = ["Inicio", "Calendario"];
const MENU_GROUPS: { title: string; icon: any; children: string[] }[] = [
  { title: "Miembros", icon: Users, children: ["Todos los Miembros", "Lista de Miembros", "Promover Miembros"] },
  { title: "Clases", icon: BookOpen, children: ["Tomar Asistencia", "Historial", "Registro de Temas", "Material Didáctico"] },
  { title: "Comunidad", icon: Users2, children: ["Grupos Pequeños", "Autorizaciones"] },
  { title: "Reportes", icon: BarChart3, children: ["Estadísticas", "Informes de Personal"] },
  { title: "Administración", icon: FolderIcon, children: ["Departamentos", "Gestión de Usuarios", "Contabilidad", "Notificaciones"] },
];

// Icon background color by category
const iconBgMap: Record<string, string> = {
  "Inicio": "bg-purple-100 text-purple-600",
  "Lista de Miembros": "bg-blue-100 text-blue-600",
  "Calendario": "bg-orange-100 text-orange-600",

  "Tomar Asistencia": "bg-teal-100 text-teal-600",
  "Historial": "bg-indigo-100 text-indigo-600",
  "Promover Miembros": "bg-pink-100 text-pink-600",
  "Autorizaciones": "bg-red-100 text-red-600",
  "Registrar Usuario": "bg-cyan-100 text-cyan-600",
  "Todos los Miembros": "bg-slate-100 text-slate-700",
  "Gestión de Usuarios": "bg-violet-100 text-violet-600",
  "Departamentos": "bg-amber-100 text-amber-600",
  "Grupos Pequeños": "bg-teal-100 text-teal-600",
  "Estadísticas": "bg-indigo-100 text-indigo-600",
  "Configuración": "bg-slate-100 text-slate-600",
  "Material Didáctico": "bg-emerald-100 text-emerald-600",
  "Mantenimiento": "bg-orange-100 text-orange-600",
  "Solicitar Reparación": "bg-orange-100 text-orange-600",
  "Registro de Temas": "bg-lime-100 text-lime-600",
  "Informes de Personal": "bg-purple-100 text-purple-600",
  "Notificaciones": "bg-pink-100 text-pink-600",
  "Guía de Uso": "bg-rose-100 text-rose-600",
  // Grupos del menú (headers desplegables)
  "Miembros": "bg-blue-100 text-blue-600",
  "Clases": "bg-emerald-100 text-emerald-600",
  "Comunidad": "bg-teal-100 text-teal-600",
  "Reportes": "bg-indigo-100 text-indigo-600",
  "Administración": "bg-amber-100 text-amber-600",
};

const NavItem = ({
  item,
  isActive,
  onClick,
  openGroup,
  setOpenGroup,
}: {
  item: { title: string; url: string; icon: any; subItems?: { title: string; url: string; badge?: number }[]; badge?: number };
  isActive: boolean;
  onClick?: () => void;
  openGroup?: string | null;
  setOpenGroup?: (t: string | null) => void;
}) => {
  const iconColor = iconBgMap[item.title] || "bg-gray-100 text-gray-500";
  const location = useLocation();
  const { collapsed } = useContext(SidebarCollapseContext);

  // ¿Alguna página de este grupo está activa? (para marcar el header y auto-abrirlo)
  const childActive = !!item.subItems?.some(sub => location.pathname + location.search === sub.url);

  // Modo rail: solo icono centrado. Al hacer hover el sidebar se expande y se ve el menú completo.
  if (collapsed) {
    const active = isActive || childActive;
    const to = item.subItems ? (item.subItems[0]?.url || item.url) : item.url;
    const badgeTotal = (item.badge || 0) + (item.subItems?.reduce((s, x) => s + (x.badge || 0), 0) || 0);
    return (
      <Link
        to={to}
        onClick={onClick}
        title={item.title}
        className={`relative flex items-center justify-center h-9 rounded-md transition-all duration-200 ${active ? "bg-primary/10" : "hover:bg-purple-50 dark:hover:bg-purple-900/20"}`}
      >
        <div className={`flex items-center justify-center w-7 h-7 rounded-md ${iconColor}`}>
          <item.icon className="h-4 w-4" />
        </div>
        {badgeTotal > 0 && (
          <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background" />
        )}
      </Link>
    );
  }

  // Auto-abrir el grupo cuyo hijo está activo (acordeón: uno solo abierto a la vez).
  useEffect(() => {
    if (childActive) setOpenGroup?.(item.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  if (item.subItems) {
    const isOpen = openGroup === item.title;
    const headerActive = isActive || childActive;
    // Badge agregado del grupo (ej. informes de personal sin leer) para verlo aun colapsado.
    const groupBadge = item.subItems.reduce((sum, s) => sum + (s.badge || 0), 0);
    return (
      <div className="space-y-1">
        <button
          onClick={() => setOpenGroup?.(isOpen ? null : item.title)}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 group ${headerActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-primary"
            }`}
        >
          <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 shrink-0 ${iconColor}`}>
            <item.icon className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-[13px] flex-1 leading-tight text-left">{item.title}</span>
          {groupBadge > 0 && !isOpen && (
            <div className="bg-red-500 text-white rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center text-[10px] font-bold shadow-sm">
              {groupBadge}
            </div>
          )}
          <ChevronRight className={`h-3.5 w-3.5 opacity-70 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
        </button>

        {isOpen && (
          <div className="ml-4 pl-4 border-l border-purple-100 dark:border-purple-900/30 space-y-1 mt-1">
            {item.subItems.map(sub => {
              const isSubActive = location.pathname + location.search === sub.url;
              return (
                <Link
                  key={sub.title}
                  to={sub.url}
                  onClick={onClick}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 text-[12px] font-bold ${isSubActive
                    ? "text-primary bg-primary/10 dark:bg-primary/20"
                    : "text-muted-foreground hover:text-primary hover:bg-purple-50/50"
                    }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isSubActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="flex-1">{sub.title}</span>
                  {sub.badge !== undefined && sub.badge > 0 && (
                    <div className="bg-red-500 text-white rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {sub.badge}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.url}
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 group ${isActive
        ? "bg-primary/10 text-primary font-semibold"
        : "text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-primary"
        }`}
    >
      <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 shrink-0 ${iconColor}`}>
        <item.icon className="h-3.5 w-3.5" />
      </div>
      <span className="font-semibold text-[13px] flex-1 leading-tight">{item.title}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <div className="bg-red-500 text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold shadow-sm">
          {item.badge}
        </div>
      )}
      {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-70 shrink-0" />}
    </Link>
  );
};

const NavigationContent = ({
  onItemClick,
  congregationName,
  showCongregationName,
  logoPath,
}: {
  onItemClick?: () => void;
  congregationName?: string;
  showCongregationName?: boolean;
  logoPath?: string;
}) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, pinnable, pinned, togglePin } = useContext(SidebarCollapseContext);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  // Acordeón del menú: solo un grupo abierto a la vez.
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const selectedDepartment = typeof window !== 'undefined' ? localStorage.getItem('selectedDepartment') : null;
  const isDirector = profile?.role === 'director' || profile?.role === 'vicedirector';

  const { data: unreadReportsCount = 0 } = useQuery({
    queryKey: ['unread_staff_reports', profile?.role, selectedDepartment],
    queryFn: () => getUnreadStaffReportsCount(profile?.role || '', selectedDepartment || profile?.departments?.[0] || ''),
    enabled: !!profile?.id && isDirector,
    refetchInterval: 15000,
  });

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });

  // Roles que pueden CREAR grupos ven el menú siempre. El resto (maestro, auxiliar, colaborador)
  // solo lo ve si está a cargo o es miembro de al menos un grupo — se resuelve consultando.
  const GROUP_CREATOR_ROLES = ['admin', 'secretaria', 'director', 'vicedirector', 'director_general', 'lider'];
  const isGroupCreatorRole = GROUP_CREATOR_ROLES.includes(profile?.role || '');
  const { data: myGroups = [] } = useQuery({
    queryKey: ['sidebar-small-groups', profile?.id],
    queryFn: () => getSmallGroups('active'),
    enabled: !!profile?.id && !isGroupCreatorRole,
    staleTime: 5 * 60 * 1000,
  });
  const hasSmallGroups = isGroupCreatorRole || myGroups.length > 0;

  const MENU_KEY_MAP: Record<string, string> = {
    "Todos los Miembros": "menu_todos_miembros",
    "Lista de Miembros": "menu_lista_miembros",
    "Tomar Asistencia": "menu_asistencia",
    "Historial": "menu_historial",
    "Promover Miembros": "menu_promover",
    "Autorizaciones": "menu_autorizaciones",
    "Estadísticas": "menu_estadisticas",
    "Registro de Temas": "menu_registro_temas",
    "Informes de Personal": "menu_informes",
    "Material Didáctico": "menu_material",
    "Departamentos": "menu_departamentos",
    "Grupos Pequeños": "menu_grupos",
    "Contabilidad": "menu_contabilidad",
    "Gestión de Usuarios": "menu_gestion_usuarios",
    "Notificaciones": "menu_notificaciones",
    "Configuración": "menu_configuracion",
    "Mantenimiento": "menu_mantenimiento",
    "Solicitar Reparación": "menu_mantenimiento",
  };

  const checkMenuPerm = (menuKey: string) => {
    const role = profile?.role || '';
    const savedPerms = (company as any)?.role_permissions?.[role];
    if (savedPerms && menuKey in savedPerms) return savedPerms[menuKey] !== false;
    return DEFAULT_PERMISSIONS[role]?.[menuKey] !== false;
  };

  const items = useMemo(() => {
    const allItems = getItems(profile?.role, profile, unreadReportsCount);
    const role = profile?.role || '';
    const savedPerms = (company as any)?.role_permissions?.[role];

    // 1. Filtrar por permisos (igual que antes, no cambia nada de la lógica de acceso).
    const visibleFlat = allItems.filter(item => {
      const menuKey = MENU_KEY_MAP[item.title];
      if (!menuKey) return true; // Inicio, Calendario siempre visibles
      if (menuKey === 'menu_grupos' && !hasSmallGroups) return false;
      if (savedPerms && menuKey in savedPerms) return savedPerms[menuKey] !== false;
      return DEFAULT_PERMISSIONS[role]?.[menuKey] !== false;
    });

    // 2. Armar la estructura agrupada: sueltos arriba, luego grupos con sus hijos visibles,
    //    y al final cualquier ítem que no caiga en un grupo (ej. Mantenimiento/Empresas).
    const byTitle = new Map(visibleFlat.map(i => [i.title, i]));
    const grouped: typeof visibleFlat = [];

    for (const t of TOP_LEVEL_ORDER) {
      if (byTitle.has(t)) { grouped.push(byTitle.get(t)!); byTitle.delete(t); }
    }
    for (const g of MENU_GROUPS) {
      const children = g.children
        .filter(t => byTitle.has(t))
        .map(t => { const it = byTitle.get(t)!; byTitle.delete(t); return { title: it.title, url: it.url, badge: it.badge }; });
      if (children.length > 0) {
        grouped.push({ title: g.title, url: "", icon: g.icon, subItems: children });
      }
    }
    for (const it of visibleFlat) {
      if (byTitle.has(it.title)) { grouped.push(it); byTitle.delete(it.title); }
    }
    return grouped;
  }, [profile?.role, profile?.departments, unreadReportsCount, company, hasSmallGroups]);

  const isAdminOrSecretary = profile?.role === 'admin' || profile?.role === 'secretaria';

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem('calendarAutoRedirected');
      await signOut();
      onItemClick?.();
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast({
        title: "Error al cerrar sesión",
        description: "Por favor intenta nuevamente",
        variant: "destructive",
      });
      sessionStorage.removeItem('calendarAutoRedirected');
      navigate("/");
      onItemClick?.();
    }
  };

  const isDirectorGeneral = profile?.role === 'director_general';

  if (profile?.departments && profile.departments.length > 1 && !selectedDepartment && !isAdminOrSecretary && !isDirectorGeneral) {
    return (
      <div className="p-4 flex flex-col gap-3 h-full justify-center">
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-purple-50 border border-purple-100">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UserRound className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-gray-600 text-center leading-relaxed">
            Por favor selecciona un departamento en el inicio de sesión
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full bg-primary text-white rounded-xl">
            Seleccionar Departamento
          </Button>
          <Button variant="ghost" onClick={handleSignOut} className="flex items-center gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full rounded-xl">
            <LogOut className="h-4 w-4" />
            <span className="font-semibold text-sm">Cerrar Sesión</span>
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase();

  const roleLabel = {
    admin: { label: "Admin", color: "bg-purple-100 text-purple-700" },
    secretaria: { label: "Secretaria", color: "bg-blue-100 text-blue-700" },
    lider: { label: "Líder", color: "bg-orange-100 text-orange-700" },
    maestro: { label: "Maestro", color: "bg-green-100 text-green-700" },
    auxiliar_maestro: { label: "Auxiliar de maestro", color: "bg-teal-100 text-teal-700" },
    director: { label: "Director", color: "bg-red-100 text-red-700" },
    "secr.-calendario": { label: "Secretaria", color: "bg-blue-100 text-blue-700" },
  }[profile?.role ?? ""] ?? { label: profile?.role ?? "", color: "bg-gray-100 text-gray-700" };

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Congregation Header + botón de anclaje (desktop) */}
      {(showCongregationName && congregationName) || pinnable ? (
        <div className={`flex items-center h-16 border-b border-border ${collapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
          {showCongregationName && congregationName && (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                <AvatarFallback className="bg-transparent">
                  <img src="/fire.png" alt="Logo" className="h-8 w-8 object-contain" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          {!collapsed && showCongregationName && congregationName && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-primary leading-tight break-words">{congregationName}</div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sistema de Gestión</div>
            </div>
          )}
          {pinnable && !collapsed && (
            <button
              onClick={togglePin}
              title={pinned ? "Desanclar menú" : "Anclar menú abierto"}
              className={`ml-auto shrink-0 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${pinned ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-900/20"}`}
            >
              <HideSidebarIcon className={`h-4 w-4 transition-transform ${pinned ? "" : "rotate-180"}`} />
            </button>
          )}
        </div>
      ) : null}

      {/* Profile Card */}
      <div
        className={`rounded-2xl bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-slate-700 cursor-pointer hover:border-purple-200 dark:hover:border-purple-600 hover:shadow-sm transition-all duration-200 ${collapsed ? "mx-2 mt-3 mb-2 p-2 flex justify-center" : "mx-3 mt-4 mb-2 p-3"}`}
        onClick={() => setProfileDialogOpen(true)}
        title={collapsed ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() : undefined}
      >
        {collapsed ? (
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
            {initials || <UserRound className="h-5 w-5" />}
          </div>
        ) : (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
            {initials || <UserRound className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-foreground truncate">
                {profile?.first_name} {profile?.last_name}
              </span>
              <Settings className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleLabel.color}`}>
                {roleLabel.label}
              </span>
              {(selectedDepartment || profile?.departments?.[0]) && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 capitalize">
                  {selectedDepartment || profile?.departments?.[0]}
                </span>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Role Switcher */}
      {!collapsed && (
        <div className="px-3 mb-2 w-full">
          <RoleSwitcher />
        </div>
      )}

      {/* Navigation section */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0">
        {!collapsed && (
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1 px-2">
            Navegación
          </div>
        )}
        {items.map(item => (
          <NavItem
            key={item.title}
            item={item}
            isActive={location.pathname === item.url}
            onClick={onItemClick}
            openGroup={openGroup}
            setOpenGroup={setOpenGroup}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div className="px-2 py-2 border-t border-border space-y-1">
        <NavItem
          item={{ title: "Guía de Uso", url: "/guia", icon: HelpCircle }}
          isActive={location.pathname === "/guia"}
          onClick={onItemClick}
        />
        {profile?.role !== "conserje" && checkMenuPerm("menu_mantenimiento") && (
          <NavItem
            item={{ title: "Solicitar Reparación", url: "/mantenimiento", icon: Wrench }}
            isActive={location.pathname === "/mantenimiento"}
            onClick={onItemClick}
          />
        )}
        {checkMenuPerm("menu_configuracion") && (
          <NavItem
            item={{ title: "Configuración", url: "/configuracion", icon: Settings }}
            isActive={location.pathname === "/configuracion"}
            onClick={onItemClick}
          />
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSignOut}
            title="Cerrar Sesión"
            className={`flex items-center flex-1 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 group ${collapsed ? "justify-center h-9" : "gap-2 px-2.5 py-1.5 text-left"}`}
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors shrink-0">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            {!collapsed && <span className="font-bold text-[13px]">Cerrar Sesión</span>}
          </button>
        </div>
      </div>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary">Editar Perfil</DialogTitle>
          </DialogHeader>
          <ProfileEditor onClose={() => setProfileDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SIDEBAR_RAIL_WIDTH = "4.5rem";   // 72px, solo iconos
const SIDEBAR_EXPANDED_WIDTH = "18rem"; // 288px, menú completo

export function AppSidebar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [congregationName, setCongregationName] = useState("");
  const [showCongregationName, setShowCongregationName] = useState(false);
  const [logoPath, setLogoPath] = useState("/fire.png");

  // Anclaje del menú: por defecto anclado (abierto). Se persiste en localStorage.
  const [pinned, setPinned] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem("sidebar_pinned") !== "false"
  );
  const [hovered, setHovered] = useState(false);
  const togglePin = () => {
    setPinned(prev => {
      const next = !prev;
      localStorage.setItem("sidebar_pinned", next ? "true" : "false");
      return next;
    });
  };
  const expanded = pinned || hovered;

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    enabled: !!user
  });

  useEffect(() => {
    if (company) {
      if (company.name && company.show_name) {
        setCongregationName(company.congregation_name || company.name || '');
        setShowCongregationName(true);
      } else {
        setShowCongregationName(false);
      }
      if (company.logo_url) {
        setLogoPath(company.logo_url.startsWith('logos/')
          ? `${STORAGE_URL}/${company.logo_url}`
          : company.logo_url);
      } else {
        setLogoPath("/fire.png");
      }
    }
  }, [company]);

  if (!user) return null;

  // ── MOBILE ──
  if (isMobile) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 border-b border-border bg-background/80 backdrop-blur-xl">

        {/* Left: Hamburger + Brand */}
        <div className="flex items-center gap-2">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-primary hover:bg-purple-50"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>

            <SheetContent
              side="left"
              className="w-[300px] p-0 border-r border-border bg-background overflow-hidden"
            >
              <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
              <div className="h-full overflow-y-auto">
                <NavigationContent
                  onItemClick={() => setIsOpen(false)}
                  congregationName={congregationName}
                  showCongregationName={showCongregationName}
                  logoPath={logoPath}
                />
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img src="/fire.png" alt="Icon" className="h-7 w-7 object-contain" />
            <span className="font-black text-lg text-primary tracking-tight">Nexus</span>
          </div>
        </div>

        {/* Right: Notificaciones + ayuda (+ nombre de congregación si entra) */}
        <div className="flex items-center gap-0.5 ml-auto">
          {showCongregationName && congregationName && (
            <span className="text-[10px] font-bold text-muted-foreground text-right leading-tight max-w-[110px] mr-1">{congregationName}</span>
          )}
          <NotificationBell />
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            <Link to="/guia" aria-label="Guía de uso">
              <HelpCircle className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── DESKTOP ──
  return (
    <SidebarCollapseContext.Provider value={{ collapsed: !expanded, pinnable: true, pinned, togglePin }}>
      {/* Spacer: acompaña SIEMPRE el ancho real del panel (expanded) para que el
          contenido y el menú se muevan juntos. Anclar/desanclar con el menú abierto
          no reacomoda la página; el contenido solo se ajusta cuando el menú se colapsa. */}
      <div
        className="shrink-0 transition-[width] duration-200 ease-in-out"
        style={{ width: expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_RAIL_WIDTH }}
      />
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed inset-y-0 left-0 z-50 flex flex-col bg-background border-r border-border shadow-sm transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_RAIL_WIDTH }}
      >
        <NavigationContent
          congregationName={congregationName}
          showCongregationName={showCongregationName}
          logoPath={logoPath}
        />
      </aside>
    </SidebarCollapseContext.Provider>
  );
}