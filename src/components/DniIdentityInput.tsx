import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupPersonByDni } from "@/lib/api";
import { Loader2, Search, UserCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DniIdentityInputProps {
    value: string;
    onChange: (value: string) => void;
    onFound: (personData: any, source: 'student' | 'profile') => void;
    onBlur?: () => void;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    id?: string;
    placeholder?: string;
}

export function DniIdentityInput({ value, onChange, onFound, onBlur, disabled, error, className, id, placeholder }: DniIdentityInputProps) {
    const [isSearching, setIsSearching] = useState(false);
    const [foundSource, setFoundSource] = useState<'student' | 'profile' | null>(null);

    const handleBlur = async () => {
        if (value && value.length >= 7) {
            setIsSearching(true);
            try {
                const result = await lookupPersonByDni(value);
                console.log("DNI Lookup Result:", result);

                const personData = result?.data || (result?.success ? result : null);
                const source = result?.source;

                if (personData && source) {
                    setFoundSource(source);
                    onFound(personData, source);
                } else {
                    setFoundSource(null);
                }
            } catch (err) {
                console.error("Error in DniIdentityInput search:", err);
            } finally {
                setIsSearching(false);
            }
        }

        // Delay onBlur slightly to allow state updates to propagate
        setTimeout(() => {
            if (onBlur) onBlur();
        }, 100);
    };

    return (
        <div className="space-y-2 relative">
            <div className="relative group w-full">
                <Input
                    id={id || "document_number"}
                    value={value}
                    onChange={(e) => {
                        const newValue = e.target.value.replace(/\D/g, '');
                        onChange(newValue);
                        if (foundSource) setFoundSource(null);
                    }}
                    onBlur={handleBlur}
                    placeholder={placeholder || "Ingrese el DNI sin puntos"}
                    error={error}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    disabled={disabled}
                    className={cn(
                        "pr-10 transition-all duration-300 h-10",
                        foundSource && "border-blue-400 bg-blue-50/30 dark:bg-blue-900/10 focus:ring-blue-500",
                        className
                    )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                    {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    ) : foundSource ? (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-md animate-in fade-in zoom-in duration-300">
                            <UserCheck className="h-3 w-3" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Vinculado</span>
                        </div>
                    ) : (
                        <Search className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors" />
                    )}
                </div>
            </div>

            {foundSource && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 italic flex items-center gap-1 animate-in slide-in-from-top-1 duration-300">
                    <Info className="h-3 w-3" />
                    Se cargaron datos automáticos de un {foundSource === 'profile' ? 'líder' : 'miembro'} existente.
                </p>
            )}
        </div>
    );
}
