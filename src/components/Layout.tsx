
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";

export const Layout = () => {
  const { user } = useAuth();

  // Si no hay usuario, no mostramos el sidebar
  if (!user) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};
