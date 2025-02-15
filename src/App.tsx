
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
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

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider
          router={createBrowserRouter([
            {
              element: <Layout />,
              children: [
                {
                  path: "/",
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
                  path: "*",
                  element: <NotFound />,
                },
              ],
            },
            {
              path: "/auth",
              element: <Auth />,
            },
          ])}
        />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
