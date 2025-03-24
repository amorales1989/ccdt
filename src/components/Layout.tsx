
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import NotificationBell from "./NotificationBell";

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
          {/* Add notification bell in top right corner */}
          <div className="fixed top-4 right-4 z-50">
            <NotificationBell />
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
