
import React from "react";
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
import { Users, UserPlus, ClipboardList, History, Home, Menu, FileText, LogOut, FolderIcon, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

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
    },
    {
      title: "Tomar Asistencia",
      url: "/asistencia",
      icon: ClipboardList,
    },
    {
      title: "Historial",
      url: "/historial",
      icon: History,
    },
  ];

  if (role === "admin" || role === "secretaria") {
    baseItems.push(
      {
        title: "Secretaría",
        url: "/secretaria",
        icon: FileText,
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

  // Si el usuario tiene múltiples departamentos y no ha seleccionado uno, mostrar mensaje
  if (profile?.departments && profile.departments.length > 1 && !selectedDepartment) {
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
                  <span className="text-sm text-muted-foreground capitalize">{profile?.role}</span>
                  {selectedDepartment && (
                    <span className="text-sm text-muted-foreground capitalize bg-accent px-2 py-0.5 rounded-full inline-block">
                      {selectedDepartment}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {profile?.departments && profile.departments.length > 0 && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                <FolderIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {profile.departments.map((dept) => (
                    <span key={dept} className="text-xs bg-accent px-2 py-0.5 rounded-full capitalize">
                      {dept}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Menú</h2>
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Comunidad Cristiana Don Torcuato</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavigationMenu />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
