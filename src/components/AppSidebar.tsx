import React, { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, ClipboardList, History, Home, Menu, FileText, LogOut, UserPlus2, UserRound, FolderIcon, FolderUp, Settings } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STORAGE_URL } from "@/integrations/supabase/client";

const getItems = (role: string | undefined) => {
  const baseItems = [
    {
      title: "Inicio",
      url: "/",
      icon: Home,
    },
    {
      title: "Lista de Alumnos",
      url: "/listar",
      icon: Users,
    },
    {
      title: "Agregar Alumno",
      url: "/agregar",
      icon: UserPlus,
    }
  ];

  if (role !== "secretaria") {
    baseItems.push({
      title: "Tomar Asistencia",
      url: "/asistencia",
      icon: ClipboardList,
    });
  }

  baseItems.push({
    title: "Promover Alumnos",
    url: "/promover",
    icon: FolderUp,
  });

  baseItems.push({
    title: "Historial",
    url: "/historial",
    icon: History,
  });

  if (role === "admin" || role === "secretaria") {
    baseItems.push(
      {
        title: "Calendario",
        url: "/calendario",
        icon: FileText,
      },
      {
        title: "Registrar Usuario",
        url: "/register",
        icon: UserPlus2,
      },
      {
        title: "Gestión de Usuarios",
        url: "/gestion-usuarios",
        icon: UserRound,
      },
      {
        title: "Departamentos",
        url: "/departamentos",
        icon: FolderIcon,
      }
    );
  }

  return baseItems;
};

const NavigationMenu = ({ onItemClick }: { onItemClick?: () => void }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const items = getItems(profile?.role);
  const selectedDepartment = localStorage.getItem('selectedDepartment');
  const isAdminOrSecretary = profile?.role === 'admin' || profile?.role === 'secretaria';
  
  const handleSignOut = async () => {
    try {
      console.log("Starting sign out from sidebar");
      await signOut();
      console.log("Sign out successful, navigating to auth");
      navigate("/auth");
      onItemClick?.();
    } catch (error: any) {
      console.error("Sign out error:", error);
      toast({
        title: "Error al cerrar sesión",
        description: "Por favor intenta nuevamente",
        variant: "destructive",
      });
    }
  };

  const handleItemClick = () => {
    onItemClick?.();
  };

  if (profile?.departments && profile.departments.length > 1 && !selectedDepartment && !isAdminOrSecretary) {
    return (
      <div className="p-4 text-center">
        <div className="flex flex-col gap-2 p-4 rounded-md bg-accent/30">
          <UserRound className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Por favor selecciona un departamento en la página de inicio de sesión para acceder al menú
          </p>
          <Button 
            variant="outline" 
            onClick={() => navigate("/auth")}
            className="mt-2"
          >
            Seleccionar Departamento
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="flex items-center gap-2 mt-2"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Cerrar Sesión</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SidebarMenu className="flex-grow">
        <SidebarMenuItem className="mb-4">
          <div className="flex flex-col gap-2 p-2 rounded-md bg-accent/30">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />
              <div className="flex flex-col">
                <span className="font-medium">{profile?.first_name} {profile?.last_name}</span>
                <div className="flex flex-col gap-1">
                  <span className="text-sm md:text-white text-black capitalize">{profile?.role}</span>
                  {!isAdminOrSecretary && selectedDepartment && (
                    <>
                      <span className="text-sm md:text-white text-black capitalize bg-accent px-2 py-0.5 rounded-full inline-block">
                        {selectedDepartment}
                      </span>
                      {profile?.assigned_class && (
                        <span className="text-sm md:text-white text-black capitalize bg-accent/50 px-2 py-0.5 rounded-full inline-block">
                          Clase: {profile.assigned_class}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SidebarMenuItem>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              className={location.pathname === item.url ? "bg-accent" : ""}
              onClick={handleItemClick}
            >
              <Link to={item.url} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50">
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <div className="mt-auto pt-4 border-t border-border/50">
        {(profile?.role === "admin" || profile?.role === "secretaria") && (
          <SidebarMenuButton
            asChild
            className={location.pathname === "/configuracion" ? "bg-accent mb-2" : "mb-2"}
            onClick={handleItemClick}
          >
            <Link to="/configuracion" className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50">
              <Settings className="h-5 w-5" />
              <span className="font-medium">Configuración</span>
            </Link>
          </SidebarMenuButton>
        )}
        <SidebarMenuButton
          onClick={handleSignOut}
          className="flex items-center gap-2 p-2 rounded-md hover:bg-destructive/10 text-destructive w-full"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Cerrar Sesión</span>
        </SidebarMenuButton>
      </div>
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
    queryKey: ['company'],
    queryFn: () => getCompany(1),
    enabled: !!user
  });

  useEffect(() => {
    if (company) {
      // Only set the congregation name if company has a name and show_name is true
      if (company.name && company.show_name) {
        setCongregationName(company.congregation_name || company.name || '');
        setShowCongregationName(true);
      } else {
        setShowCongregationName(false);
      }
      
      // Set logo path if available
      if (company.logo_url) {
        // Check if the logo URL is a Supabase storage URL
        if (company.logo_url.startsWith('logos/')) {
          // Correct format for Supabase storage URLs
          setLogoPath(`${STORAGE_URL}/${company.logo_url}`);
        } else {
          setLogoPath(company.logo_url);
        }
      } else {
        setLogoPath("/fire.png"); // Default logo
      }
    }
  }, [company]);

  if (!user) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-accent/50">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="h-full bg-background">
              <div className="p-4 border-b flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                  <AvatarFallback>
                    <img src="/fire.png" alt="Default Logo" className="h-full w-full object-contain" />
                  </AvatarFallback>
                </Avatar>
                {showCongregationName && congregationName && (
                  <h2 className="text-lg font-semibold">{congregationName}</h2>
                )}
              </div>
              <nav className="p-2">
                <NavigationMenu onItemClick={() => setIsOpen(false)} />
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <Sidebar>
      <SidebarContent className="w-64">
        <SidebarGroup>
          {showCongregationName && congregationName && (
            <SidebarGroupLabel className="flex items-center">
              <Avatar className="h-6 w-6 mr-2">
                <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                <AvatarFallback>
                  <img src="/fire.png" alt="Default Logo" className="h-full w-full object-contain" />
                </AvatarFallback>
              </Avatar>
              {congregationName}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <NavigationMenu />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
