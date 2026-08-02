import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDepartments } from "@/hooks/useDepartments";
import { Department } from "@/types/database";
import { ALL_VALUE, formatDepartmentName } from "@/lib/departments";

interface DepartmentSelectProps {
  value?: string | null;
  /** Recibe el nombre y el departamento completo (undefined si se eligio "todos"). */
  onChange: (name: string, department?: Department) => void;
  /** Limita a los departamentos que el perfil puede ver. */
  scoped?: boolean;
  includeAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Clases del trigger. */
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
}

export const DepartmentSelect = ({
  value,
  onChange,
  scoped = false,
  includeAll = false,
  allLabel = "Todos los departamentos",
  placeholder = "Selecciona un departamento",
  disabled,
  className,
  contentClassName,
  itemClassName,
}: DepartmentSelectProps) => {
  const { departments } = useDepartments({ scoped });

  return (
    <Select
      value={value || undefined}
      onValueChange={(val) => onChange(val, departments.find(d => d.name === val))}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {includeAll && <SelectItem value={ALL_VALUE} className={itemClassName}>{allLabel}</SelectItem>}
        {departments.map((dept) => (
          <SelectItem key={dept.id} value={dept.name} className={itemClassName}>
            {formatDepartmentName(dept.name)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
