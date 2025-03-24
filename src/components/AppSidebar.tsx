import {
  Home,
  Users,
  Calendar,
  ClipboardList,
  Settings,
  UserPlus,
  Database,
  ArrowUpDown,
  Bell,
  Send
} from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getCompany } from "@/lib/api";
import { Company } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import NotificationBadge from './NotificationBadge';

interface NavItem {
  title: string;
  icon: React.ReactNode;
  href: string;
}

interface NavSection {
  canAccess: string[];
  items: NavItem[];
}

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  title: string;
  href: string;
  active: boolean;
}

const AppSidebar = ({ open, setOpen }: SidebarProps) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      setLoading(true);
      try {
        const companyData = await getCompany();
        setCompany(companyData);
      } catch (error) {
        console.error("Error fetching company:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, []);

  const navSections: NavSection[] = [
    {
      canAccess: ["admin", "lider", "director", "maestro", "secretaria"],
      items: [
        {
          title: "Inicio",
          icon: <Home className="h-4 w-4" />,
          href: "/",
        },
      ],
    },
    {
      canAccess: ["admin", "secretaria"],
      items: [
        {
          title: "Alumnos",
          icon: <Users className="h-4 w-4" />,
          href: "/alumnos",
        },
        {
          title: "Agregar Alumno",
          icon: <UserPlus className="h-4 w-4" />,
          href: "/agregar-alumno",
        },
      ],
    },
    {
      canAccess: ["admin", "lider", "director", "maestro", "secretaria"],
      items: [
        {
          title: "Tomar Asistencia",
          icon: <ClipboardList className="h-4 w-4" />,
          href: "/tomar-asistencia",
        },
        {
          title: "Eventos",
          icon: <Calendar className="h-4 w-4" />,
          href: "/eventos",
        },
      ],
    },
    {
      canAccess: ["admin"],
      items: [
        {
          title: "Departamentos",
          icon: <Database className="h-4 w-4" />,
          href: "/departamentos",
        },
        {
          title: "Ajustes",
          icon: <Settings className="h-4 w-4" />,
          href: "/ajustes",
        },
        {
          title: "Migraciones",
          icon: <ArrowUpDown className="h-4 w-4" />,
          href: "/migraciones",
        },
      ],
    },
    {
      canAccess: ["admin", "secretaria"],
      items: [
        {
          title: "Crear Notificación",
          icon: <Send className="h-4 w-4" />,
          href: "/crear-notificacion",
        },
      ],
    },
    {
      canAccess: ["admin", "lider", "director", "maestro", "secretaria"],
      items: [
        {
          title: "Notificaciones",
          icon: <Bell className="h-4 w-4" />,
          href: "/notificaciones",
        },
      ],
    },
  ];

  const SidebarItem = ({ icon, title, href, active }: SidebarItemProps) => {
    const isNotifications = href === '/notificaciones';
    
    return (
      <Link
        to={href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
          active ? "bg-muted font-medium text-primary" : "text-muted-foreground"
        )}
      >
        {icon}
        <span>{title}</span>
        {isNotifications && <NotificationBadge className="ml-auto" />}
      </Link>
    );
  };

  const SidebarSection = ({ section }: { section: NavSection }) => {
    if (!profile || !section.canAccess.includes(profile.role)) {
      return null;
    }

    return (
      <div className="pb-4">
        {section.items.map((item) => (
          <SidebarItem
            key={item.title}
            icon={item.icon}
            title={item.title}
            href={item.href}
            active={location.pathname === item.href}
          />
        ))}
      </div>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r bg-background transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"
        }`}
    >
      <div className="px-6 py-4">
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <NavLink to="/" className="flex items-center space-x-2 font-semibold">
            <img src={company?.logo_url} alt={company?.name} className="h-8" />
            <span>{company?.name}</span>
          </NavLink>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6">
        {navSections.map((section, index) => (
          <SidebarSection key={index} section={section} />
        ))}
      </div>
    </aside>
  );
};

export default AppSidebar;
