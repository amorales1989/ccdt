
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function Layout() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Si no hay usuario, no mostramos el sidebar
  if (!user) {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className={`flex-1 overflow-x-hidden ${isMobile ? 'pt-20' : 'p-4'}`}>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
