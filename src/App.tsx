
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import Index from "@/pages/Index";
import ListarAlumnos from "@/pages/ListarAlumnos";
import AgregarAlumno from "@/pages/AgregarAlumno";
import TomarAsistencia from "@/pages/TomarAsistencia";
import HistorialAsistencia from "@/pages/HistorialAsistencia";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import Register from "@/pages/Register";
import GestionUsuarios from "@/pages/GestionUsuarios";
import Calendario from "@/pages/Calendario";
import Departamentos from "@/pages/Departamentos";
import PromoverAlumnos from "@/pages/PromoverAlumnos";
import Configuration from "@/pages/Configuration";
import Notificaciones from "./pages/Notificaciones";
import CrearNotificacion from "./pages/CrearNotificacion";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <RouterProvider
            router={createBrowserRouter([
              {
                path: "/",
                element: <Layout />,
                children: [
                  {
                    index: true,
                    element: <Index />,
                  },
                  {
                    path: "/listar",
                    element: <ListarAlumnos />,
                  },
                  {
                    path: "/agregar",
                    element: <AgregarAlumno />,
                  },
                  {
                    path: "/asistencia",
                    element: <TomarAsistencia />,
                  },
                  {
                    path: "/historial",
                    element: <HistorialAsistencia />,
                  },
                  {
                    path: "/calendario",
                    element: <Calendario />,
                  },
                  {
                    path: "/register",
                    element: <Register />,
                  },
                  {
                    path: "/gestion-usuarios",
                    element: <GestionUsuarios />,
                  },
                  {
                    path: "/departamentos",
                    element: <Departamentos />,
                  },
                  {
                    path: "/promover",
                    element: <PromoverAlumnos />,
                  },
                  {
                    path: "/configuracion",
                    element: <Configuration />,
                  },
                  {
                    path: "/notificaciones",
                    element: <Notificaciones />,
                  },
                  {
                    path: "/crear-notificacion",
                    element: <CrearNotificacion />,
                  },
                  {
                    path: "*",
                    element: <NotFound />,
                  },
                ],
              },
              {
                path: "/auth",
                element: <Auth />,
              },
              {
                path: "*",
                element: <Navigate to="/auth" replace />,
              },
            ])}
          />
          <Toaster />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
