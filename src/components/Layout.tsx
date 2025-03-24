
import { Outlet, Navigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function Layout() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  // While authentication is being checked, show nothing
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  // If no user is authenticated and we've finished loading auth state, redirect to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className={`flex-1 overflow-x-hidden ${isMobile ? 'pt-20' : 'p-4'}`}>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
