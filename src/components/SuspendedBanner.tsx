import { Lock } from "lucide-react";

// Cartel para la cuenta suspendida. Sin motivo: el flag `suspended` es lo único que se guarda.
export function SuspendedBanner() {
  return (
    <div className="relative z-20 mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 flex items-start gap-2">
      <Lock className="h-4 w-4 shrink-0 mt-0.5" />
      <span>
        Tu cuenta está suspendida. Por ahora solo podés ver el calendario de actividades y editar
        tus datos personales. Contactá al director de tu departamento para más información.
      </span>
    </div>
  );
}
