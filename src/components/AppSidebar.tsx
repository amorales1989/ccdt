import React, { useState, useEffect, useMemo } from "react";
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
  BarChart3
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STORAGE_URL } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileEditor } from "@/components/ProfileEditor";

const getItems = (role: string | undefined, profile: any) => {
  const selectedDepartment = localStorage.getItem('selectedDepartment');
  if (selectedDepartment === 'calendario' || profile?.departments?.[0] === 'calendario') {
    const calendarItems: { title: string; url: string; icon: any; subItems?: { title: string; url: string }[] }[] = [
      { title: "Inicio", url: "/", icon: Home },
      { title: "Calendario", url: "/calendario", icon: FileText }
    ];
    return calendarItems;
  }

  const baseItems: { title: string; url: string; icon: any; subItems?: { title: string; url: string }[] }[] = [
    { title: "Inicio", url: "/", icon: Home },
    { title: "Lista de Miembros", url: "/listar", icon: Users },
    { title: "Calendario", url: "/calendario", icon: FileText },
  ];

  if (role !== "secretaria") {
    baseItems.push({ title: "Tomar Asistencia", url: "/asistencia", icon: ClipboardList });
  }

  if (role === "lider") {
    const userDepartment = profile?.departments?.[0] || selectedDepartment;
    if (userDepartment === "adolescentes") {
      baseItems.push({ title: "Autorizaciones", url: "/autorizaciones", icon: FileOutput });
    }
  }

  baseItems.push({ title: "Promover Miembros", url: "/promover", icon: FolderUp });
  baseItems.push({ title: "Historial", url: "/historial", icon: History });

  if (role === "admin" || role === "secretaria" || role === "director") {
    if (role === "admin" || role === "secretaria") {
      baseItems.push(
        {
          title: "Estadísticas",
          url: "/estadisticas",
          icon: BarChart3,
          subItems: [
            { title: "Por Edad", url: "/estadisticas?view=age" },
            { title: "Por Clases", url: "/estadisticas?view=class" }
          ]
        },
        { title: "Autorizaciones", url: "/autorizaciones", icon: FileOutput },
        { title: "Departamentos", url: "/departamentos", icon: FolderIcon }
      );
    } else if (role === "director") {
      baseItems.push(
        {
          title: "Estadísticas",
          url: "/estadisticas",
          icon: BarChart3,
          subItems: [
            { title: "Por Edad", url: "/estadisticas?view=age" },
            { title: "Por Clases", url: "/estadisticas?view=class" }
          ]
        }
      );
    }
    baseItems.push(
      { title: "Gestión de Usuarios", url: "/gestion-usuarios", icon: UserRound }
    );
  }

  return baseItems;
};

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
  "Gestión de Usuarios": "bg-violet-100 text-violet-600",
  "Departamentos": "bg-amber-100 text-amber-600",
  "Estadísticas": "bg-indigo-100 text-indigo-600",
  "Configuración": "bg-slate-100 text-slate-600",
};

const NavItem = ({
  item,
  isActive,
  onClick
}: {
  item: { title: string; url: string; icon: any; subItems?: { title: string; url: string }[] };
  isActive: boolean;
  onClick?: () => void;
}) => {
  const iconColor = iconBgMap[item.title] || "bg-gray-100 text-gray-500";
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Auto-expand if sub-item is active
  useEffect(() => {
    if (item.subItems?.some(sub => location.pathname + location.search === sub.url)) {
      setIsOpen(true);
    }
  }, [location.pathname, location.search, item.subItems]);

  if (item.subItems) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 group ${isActive
            ? "bg-primary text-white shadow-md shadow-primary/20"
            : "text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-primary"
            }`}
        >
          <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 shrink-0 ${isActive ? "bg-white/20" : iconColor
            }`}>
            <item.icon className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold text-[13px] flex-1 leading-tight text-left">{item.title}</span>
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
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-[12px] font-bold ${isSubActive
                    ? "text-primary bg-purple-50 dark:bg-purple-900/20"
                    : "text-muted-foreground hover:text-primary hover:bg-purple-50/50"
                    }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isSubActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  {sub.title}
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
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 group ${isActive
        ? "bg-primary text-white shadow-md shadow-primary/20"
        : "text-muted-foreground hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-primary"
        }`}
    >
      <div className={`flex items-center justify-center w-6 h-6 rounded-md transition-all duration-200 shrink-0 ${isActive ? "bg-white/20" : iconColor
        }`}>
        <item.icon className="h-3.5 w-3.5" />
      </div>
      <span className="font-semibold text-[13px] flex-1 leading-tight">{item.title}</span>
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
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const items = useMemo(() => {
    return getItems(profile?.role, profile);
  }, [profile?.role, profile?.departments]);

  const selectedDepartment = localStorage.getItem('selectedDepartment');
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

  if (profile?.departments && profile.departments.length > 1 && !selectedDepartment && !isAdminOrSecretary) {
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
    director: { label: "Director", color: "bg-red-100 text-red-700" },
    "secr.-calendario": { label: "Secretaria", color: "bg-blue-100 text-blue-700" },
  }[profile?.role ?? ""] ?? { label: profile?.role ?? "", color: "bg-gray-100 text-gray-700" };

  return (
    <div className="flex flex-col h-full">
      {/* Logo / Congregation Header */}
      {showCongregationName && congregationName && (
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
            <Avatar className="h-9 w-9">
              <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
              <AvatarFallback className="bg-transparent">
                <img src="/fire.png" alt="Logo" className="h-8 w-8 object-contain" />
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-primary leading-tight break-words">{congregationName}</div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sistema de Gestión</div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div
        className="mx-3 mt-4 mb-2 p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-slate-700 cursor-pointer hover:border-purple-200 dark:hover:border-purple-600 hover:shadow-sm transition-all duration-200"
        onClick={() => setProfileDialogOpen(true)}
      >
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
      </div>

      {/* Navigation section */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0">
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1 px-2">
          Navegación
        </div>
        {items.map(item => (
          <NavItem
            key={item.title}
            item={item}
            isActive={location.pathname === item.url}
            onClick={onItemClick}
          />
        ))}
      </div>

      {/* Bottom section */}
      <div className="px-2 py-2 border-t border-border space-y-1">
        {(profile?.role === "admin" || profile?.role === "secretaria") && (
          <NavItem
            item={{ title: "Configuración", url: "/configuracion", icon: Settings }}
            isActive={location.pathname === "/configuracion"}
            onClick={onItemClick}
          />
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 group text-left"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-red-100 group-hover:bg-red-200 transition-colors shrink-0">
              <LogOut className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-[13px]">Cerrar Sesión</span>
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

export function AppSidebar() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [congregationName, setCongregationName] = useState("");
  const [showCongregationName, setShowCongregationName] = useState(false);
  const [logoPath, setLogoPath] = useState("/fire.png");

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
            <span className="font-black text-lg text-primary tracking-tight">CCDT</span>
          </div>
        </div>

        {/* Right: Congregation name if available */}
        {showCongregationName && congregationName && (
          <span className="text-[10px] font-bold text-muted-foreground text-right leading-tight ml-auto max-w-[150px]">{congregationName}</span>
        )}
      </div>
    );
  }

  // ── DESKTOP ──
  return (
    <Sidebar className="border-r border-border">
      <SidebarContent className="bg-background h-full overflow-hidden">
        <NavigationContent
          congregationName={congregationName}
          showCongregationName={showCongregationName}
          logoPath={logoPath}
        />
      </SidebarContent>
    </Sidebar>
  );
}