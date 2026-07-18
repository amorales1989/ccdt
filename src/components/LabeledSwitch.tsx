import { Switch } from "@/components/ui/switch";

interface LabeledSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Muestra el switch dentro de una caja con borde, misma altura que un Input */
  boxed?: boolean;
  className?: string;
}

// Switch con etiqueta reutilizable (ej. campo "Bautizado" en formularios y filtros).
export function LabeledSwitch({ label, checked, onCheckedChange, boxed, className = "" }: LabeledSwitchProps) {
  return (
    <label
      className={`flex items-center gap-2.5 cursor-pointer select-none text-sm font-medium text-slate-700 dark:text-slate-300 ${
        boxed ? "h-10 px-3 rounded-md border border-input" : ""
      } ${className}`}
    >
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {label}
    </label>
  );
}
