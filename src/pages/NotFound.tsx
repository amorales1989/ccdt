
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Si estamos en una ruta que no es "/" y no es una ruta válida,
    // redirigimos a la página principal
    if (location.pathname !== "/") {
      console.log("Redirigiendo a página principal desde:", location.pathname);
      navigate("/", { replace: true });
      return;
    }

    console.error(
      "404 Error: Usuario intentó acceder a ruta inexistente:",
      location.pathname
    );
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">¡Oops! Página no encontrada</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Volver al Inicio
        </a>
      </div>
    </div>
  );
};

export default NotFound;
