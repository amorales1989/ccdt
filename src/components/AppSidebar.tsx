import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  ChevronLeft,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  FileText,
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface NavbarLinkProps {
  to: string;
  icon: React.ComponentType<any>;
  isOpen: boolean;
  children: React.ReactNode;
}

const NavbarLink: React.FC<NavbarLinkProps> = ({ to, icon: Icon, isOpen, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground",
          isActive ? "bg-secondary text-foreground" : "text-muted-foreground",
          isOpen ? "justify-start" : "justify-center"
        )
      }
    >
      <Icon className="h-4 w-4" />
      <span className={cn(isOpen ? "flex-1" : "sr-only")}>{children}</span>
    </NavLink>
  );
};

export const AppSidebar = ({ isAdmin }: { isAdmin: boolean }) => {
  const [isOpen, setIsOpen] = useState(true);
  const { profile } = useAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsOpen(window.innerWidth >= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r bg-background transition-all duration-300 ease-in-out",
      isOpen ? "w-64" : "w-14",
    )}>
      <div className="flex items-center justify-between px-3 py-2">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="text-xl font-semibold">
            {isOpen ? "GesCole" : "GC"}
          </span>
        </Link>
        {isMobile ? (
          <Sheet>
            <SheetTrigger asChild>
              <Menu className="h-6 w-6 cursor-pointer" onClick={() => setIsOpen(!isOpen)} />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>
                  See all available options
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1">
                <div className={cn("px-2 py-2", isOpen ? "px-4" : "px-2")}>
                  <div className="mb-4">
                    <h2 className={cn(
                      "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
                      !isOpen && "sr-only"
                    )}>
                      General
                    </h2>
                    <nav className="grid gap-1">
                      <NavbarLink to="/home" icon={LayoutDashboard} isOpen={isOpen}>
                        Dashboard
                      </NavbarLink>
                    </nav>
                  </div>

                  {isAdmin && (
                    <div className="my-4">
                      <h2 className={cn(
                        "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
                        !isOpen && "sr-only"
                      )}>
                        Administración
                      </h2>
                      <nav className="grid gap-1">
                        <NavbarLink to="/admin/users" icon={Users} isOpen={isOpen}>
                          Usuarios
                        </NavbarLink>
                      </nav>
                    </div>
                  )}

                  <div className="my-4">
                    <h2 className={cn(
                      "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
                      !isOpen && "sr-only"
                    )}>
                      Gestión
                    </h2>
                    <nav className="grid gap-1">
                      <NavbarLink to="/promover" icon={Users} isOpen={isOpen}>
                        Promover Alumnos
                      </NavbarLink>
                      
                      <NavbarLink to="/autorizaciones" icon={FileText} isOpen={isOpen}>
                        Autorizaciones
                      </NavbarLink>
                    </nav>
                  </div>

                  <div className="mt-auto pt-6">
                    <h2 className={cn(
                      "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
                      !isOpen && "sr-only"
                    )}>
                      Ajustes
                    </h2>
                    <nav className="grid gap-1">
                      <NavbarLink to="/settings" icon={Settings} isOpen={isOpen}>
                        Configuración
                      </NavbarLink>
                    </nav>
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        ) : (
          <ChevronLeft className="h-6 w-6 cursor-pointer" onClick={() => setIsOpen(!isOpen)} />
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className={cn("px-2 py-2", isOpen ? "px-4" : "px-2")}>
          <div className="mb-4">
            <h2 className={cn(
              "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
              !isOpen && "sr-only"
            )}>
              General
            </h2>
            <nav className="grid gap-1">
              <NavbarLink to="/home" icon={LayoutDashboard} isOpen={isOpen}>
                Dashboard
              </NavbarLink>
            </nav>
          </div>

          {isAdmin && (
            <div className="my-4">
              <h2 className={cn(
                "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
                !isOpen && "sr-only"
              )}>
                Administración
              </h2>
              <nav className="grid gap-1">
                <NavbarLink to="/admin/users" icon={Users} isOpen={isOpen}>
                  Usuarios
                </NavbarLink>
              </nav>
            </div>
          )}
          
          <div className="my-4">
            <h2 className={cn(
              "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
              !isOpen && "sr-only"
            )}>
              Gestión
            </h2>
            <nav className="grid gap-1">
              <NavbarLink to="/promover" icon={Users} isOpen={isOpen}>
                Promover Alumnos
              </NavbarLink>
              
              <NavbarLink to="/autorizaciones" icon={FileText} isOpen={isOpen}>
                Autorizaciones
              </NavbarLink>
            </nav>
          </div>
          
          <div className="mt-auto pt-6">
            <h2 className={cn(
              "mb-2 text-muted-foreground text-xs font-medium uppercase tracking-wider",
              !isOpen && "sr-only"
            )}>
              Ajustes
            </h2>
            <nav className="grid gap-1">
              <NavbarLink to="/settings" icon={Settings} isOpen={isOpen}>
                Configuración
              </NavbarLink>
            </nav>
          </div>
        </div>
      </ScrollArea>
      
      <div className="border-t px-3 py-2">
        {profile && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{profile.first_name}</span>
              <span className="text-xs text-muted-foreground">{profile.role}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
