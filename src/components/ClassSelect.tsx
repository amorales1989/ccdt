import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_VALUE } from "@/lib/departments";

interface ClassSelectProps {
  /** Clases del departamento seleccionado (dept.classes). */
  classes: string[];
  value?: string | null;
  onChange: (value: string) => void;
  includeAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Clases del trigger. */
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export const ClassSelect = ({
  classes,
  value,
  onChange,
  includeAll = false,
  allLabel = "Todas las clases",
  placeholder = "Selecciona una clase",
  disabled,
  className,
  contentClassName,
  itemClassName,
}: ClassSelectProps) => (
  <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger className={className}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className={contentClassName}>
      {includeAll && <SelectItem value={ALL_VALUE} className={itemClassName}>{allLabel}</SelectItem>}
      {classes.map((className_) => (
        <SelectItem key={className_} value={className_} className={itemClassName}>
          {className_}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
