import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { isDemoMode, exitDemo } from "@/lib/demo";
import { toast } from "@/hooks/use-toast";

// Barra fija visible solo en modo demo. Avisa que los cambios no se guardan
// y permite salir hacia la presentación.
export function DemoBanner() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
    if (!isDemoMode()) return;
    document.body.classList.add("demo-mode");
    let last = 0;
    const onWrite = () => {
      const now = Date.now();
      if (now - last < 1500) return; // evita spam de toasts
      last = now;
      toast({
        title: "Modo demo",
        description: "Los cambios no se guardan en este entorno de prueba.",
      });
    };
    window.addEventListener("nexus-demo-write", onWrite);
    return () => {
      window.removeEventListener("nexus-demo-write", onWrite);
      document.body.classList.remove("demo-mode");
    };
  }, []);

  if (!demo) return null;

  const salir = () => {
    exitDemo();
    window.location.href = "/presentacion";
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[100] h-9 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium truncate">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">Modo demo · datos de ejemplo · los cambios no se guardan</span>
        </span>
        <button
          onClick={salir}
          className="flex items-center gap-1 rounded-md bg-white/15 hover:bg-white/25 px-2.5 py-1 font-semibold transition shrink-0"
        >
          <X className="h-3.5 w-3.5" /> Salir
        </button>
      </div>
    </div>
  );
}
