import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon: LucideIcon;
  /** Botones, selects o indicadores que van a la derecha del título. */
  actions?: ReactNode;
  /** Ancla de los tours guiados (TourGuide apunta a `[data-tour="..."]`). */
  "data-tour"?: string;
}

/**
 * Encabezado estándar de toda pantalla (estilo "B", el de Contabilidad).
 *
 * A propósito no acepta className ni variantes de tamaño o color: si se pudiera, las 12
 * formas de título que había volverían a aparecer adentro del componente.
 */
export function PageHeader({ title, subtitle, icon: Icon, actions, "data-tour": dataTour }: PageHeaderProps) {
  return (
    <div
      data-tour={dataTour}
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h1>
          {/* div y no p: el subtítulo puede traer elementos de bloque (un <p> con un <div>
              adentro es HTML inválido y React lo avisa en consola). Gris explícito y no
              text-muted-foreground: esa clase no existe en la config de Tailwind de este proyecto. */}
          {subtitle && <div className="text-slate-500 dark:text-slate-400 mt-1 font-medium">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap ml-auto">{actions}</div>}
    </div>
  );
}
