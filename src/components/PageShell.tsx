import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Contenedor estándar de toda pantalla (estilo "B", el de Contabilidad).
 *
 * - Sin fondo propio: hereda el del <main> del Layout. Las páginas que traían el suyo
 *   se superponían con él.
 * - Sin `animate-fade-in`: esa animación deja un `transform` aplicado para siempre, y un
 *   ancestro con transform rompe los `position: fixed` hijos (ej. la barra de TomarAsistencia).
 * - `className` es solo para excepciones de layout (un ancho de lectura más angosto, por
 *   ejemplo), no para cambiar el aspecto.
 */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    // Padding por lados y no `p-4 md:p-6`: el shorthand responsive pisaba en escritorio
    // cualquier `pb-*` pasado por className (TomarAsistencia necesita pb-28 para su barra fija).
    <div className={cn("px-4 md:px-6 pt-4 md:pt-6 pb-8 max-w-[1600px] mx-auto space-y-6", className)}>
      {children}
    </div>
  );
}
