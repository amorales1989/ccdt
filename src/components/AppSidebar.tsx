import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Users, UserPlus, ClipboardList, History } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const items = [
  {
    title: "Lista de Alumnos",
    url: "/",
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

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Adolescentes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={location.pathname === item.url ? "bg-accent" : ""}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}