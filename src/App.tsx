import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Layout } from "@/components/Layout";
import { InstallPWA } from "@/components/InstallPWA"; // 👈 Importar
import Index from "@/pages/Index";


import Landing from "@/pages/Landing";
import { NotificationHandler } from '@/components/NotificationHandler';
import { DemoBanner } from '@/components/DemoBanner';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { RouteErrorElement } from '@/components/ErrorBoundary';

// Las paginas se bajan al entrar, no en el arranque. Index y Landing quedan eager
// porque son el primer paint.
const Home = lazy(() => import("@/pages/Home"));
const ListarAlumnos = lazy(() => import("@/pages/ListarAlumnos"));
const AgregarAlumno = lazy(() => import("@/pages/AgregarAlumno"));
const TomarAsistencia = lazy(() => import("@/pages/TomarAsistencia"));
const HistorialAsistencia = lazy(() => import("@/pages/HistorialAsistencia"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const GestionUsuarios = lazy(() => import("@/pages/GestionUsuarios"));
const Calendario = lazy(() => import("@/pages/Calendario"));
const Departamentos = lazy(() => import("@/pages/Departamentos"));
const GruposPequenos = lazy(() => import("@/pages/GruposPequenos"));
const Contabilidad = lazy(() => import("@/pages/Contabilidad"));
const PromoverAlumnos = lazy(() => import("@/pages/PromoverAlumnos"));
const Configuration = lazy(() => import("@/pages/Configuration"));
const Notificaciones = lazy(() => import("@/pages/Notificaciones"));
const AutorizacionesSalida = lazy(() => import("@/pages/AutorizacionesSalida"));
const AutorizacionSimple = lazy(() => import("@/pages/AutorizacionSimple"));
const AutorizacionCampamento = lazy(() => import("@/pages/AutorizacionCampamento"));
const Material = lazy(() => import("@/pages/Material"));
const Mantenimiento = lazy(() => import("@/pages/Mantenimiento"));
const InformesPersonal = lazy(() => import("@/pages/InformesPersonal"));
const RegistroTemas = lazy(() => import("@/pages/RegistroTemas"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Guia = lazy(() => import("@/pages/Guia"));
const Estadisticas = lazy(() => import("@/pages/Estadisticas"));
const TodosMiembros = lazy(() => import("@/pages/TodosMiembros"));
const ArchivoMiembros = lazy(() => import("@/pages/ArchivoMiembros"));
const AdminSistema = lazy(() => import("@/pages/AdminSistema"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const isMarketingDomain =
  typeof window !== "undefined" &&
  ["n-xus.com", "www.n-xus.com"].includes(window.location.hostname);

// En el dominio de marketing, la landing es solo para visitantes anónimos.
// Un usuario autenticado que entra a "/" debe ver la app (Index redirige a su home).
function RootIndex() {
  const { user, loading } = useAuth();
  if (!isMarketingDomain) return <Index />;
  if (loading) return null;
  return user ? <Index /> : <Landing />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <DemoBanner />
          <div className="demo-shift-wrapper">
          <Suspense fallback={<LoadingOverlay message="Cargando..." />}>
          <RouterProvider
            router={createBrowserRouter([
              {
                path: "/",
                element: <Layout />,
                errorElement: <RouteErrorElement />,
                children: [
                  {
                    index: true,
                    element: <RootIndex />,
                  },
                  {
                    path: "/login",
                    element: <Index />,
                  },
                  {
                    path: "/home",
                    element: <Home />,
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
                    path: "/estadisticas",
                    element: <Estadisticas />,
                  },
                  {
                    path: "/calendario",
                    element: <Calendario />,
                  },
                  {
                    path: "/material",
                    element: <Material />,
                  },
                  {
                    path: "/mantenimiento",
                    element: <Mantenimiento />,
                  },
                  {
                    path: "/informes",
                    element: <InformesPersonal />,
                  },
                  {
                    path: "/registro-temas",
                    element: <RegistroTemas />,
                  },



                  {
                    path: "/todos-los-miembros",
                    element: <TodosMiembros />,
                  },
                  {
                    path: "/archivo",
                    element: <ArchivoMiembros />,
                  },
                  {
                    path: "/gestion-usuarios",
                    element: <GestionUsuarios />,
                  },
                  {
                    path: "/admin-sistema",
                    element: <AdminSistema />,
                  },
                  {
                    path: "/departamentos",
                    element: <Departamentos />,
                  },
                  {
                    path: "/grupos",
                    element: <GruposPequenos />,
                  },
                  {
                    path: "/contabilidad",
                    element: <Contabilidad />,
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
                    path: "/guia",
                    element: <Guia />,
                  },
                  {
                    path: "/notificaciones",
                    element: <Notificaciones />,
                  },
                  {
                    path: "/autorizaciones",
                    element: <AutorizacionesSalida />,
                  },
                  {
                    path: "/autorizaciones/campamento",
                    element: <AutorizacionCampamento />,
                  },
                  {
                    path: "/autorizaciones/simple",
                    element: <AutorizacionSimple />,
                  },
                  {
                    path: "*",
                    element: <NotFound />,
                  },
                ],
              },
              {
                path: "/reset-password",
                element: <ResetPassword />,
                errorElement: <RouteErrorElement />,
              },
              {
                path: "/presentacion",
                element: <Landing />,
                errorElement: <RouteErrorElement />,
              },
              {
                path: "*",
                element: <Navigate to="/" replace />,
              },
            ])}
          />
          </Suspense>
          </div>
          <NotificationHandler />
          <Toaster />
          <InstallPWA />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;