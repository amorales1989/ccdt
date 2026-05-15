import * as React from "react"
import { User, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { supabase } from "@/integrations/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { getPersistentCompanyId } from "@/contexts/CompanyContext"
import type { PersonSearchResult } from "./PersonSearchInput"

interface NameSearchInputProps {
    id?: string
    value: string
    onChange: (value: string) => void
    onSelect: (person: PersonSearchResult) => void
    placeholder?: string
    className?: string
    required?: boolean
    disabled?: boolean
}

export function NameSearchInput({
    id,
    value,
    onChange,
    onSelect,
    placeholder = "Ej. Juan",
    className,
    required,
    disabled,
}: NameSearchInputProps) {
    const [open, setOpen] = React.useState(false)
    const [debounced, setDebounced] = React.useState(value)
    const [justSelected, setJustSelected] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const t = setTimeout(() => setDebounced(value), 250)
        return () => clearTimeout(t)
    }, [value])

    React.useEffect(() => {
        const onClickOut = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onClickOut)
        return () => document.removeEventListener('mousedown', onClickOut)
    }, [])

    const { data: results = [], isLoading } = useQuery({
        queryKey: ['name-search', debounced],
        queryFn: async () => {
            if (debounced.trim().length < 2) return []
            const term = `%${debounced.trim()}%`
            const companyId = getPersistentCompanyId()

            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .or(`first_name.ilike.${term},last_name.ilike.${term}`)
                .eq('company_id', companyId)
                .limit(5) as { data: any[] }

            const { data: students } = await supabase
                .from('students')
                .select('*')
                .or(`first_name.ilike.${term},last_name.ilike.${term}`)
                .eq('company_id', companyId)
                .is('deleted_at', null)
                .limit(5) as { data: any[] }

            const flattened: PersonSearchResult[] = [
                ...(profiles?.map(p => ({
                    id: p.id,
                    first_name: p.first_name || "",
                    last_name: p.last_name || "",
                    email: p.email || undefined,
                    role: p.role,
                    source: 'profile' as const,
                    department: p.departments?.[0],
                    assigned_class: p.assigned_class || undefined,
                    gender: p.gender,
                    birthdate: p.birthdate || undefined,
                    address: p.address || undefined,
                    document_number: p.document_number || undefined,
                    phone: p.phone || undefined,
                })) || []),
                ...(students?.map(s => ({
                    id: s.id,
                    profile_id: s.profile_id,
                    first_name: s.first_name || "",
                    last_name: s.last_name || "",
                    role: 'miembro',
                    source: 'student' as const,
                    department: s.department || undefined,
                    assigned_class: s.assigned_class || undefined,
                    gender: s.gender,
                    birthdate: s.birthdate || undefined,
                    address: s.address || undefined,
                    document_number: s.document_number || undefined,
                    phone: s.phone || undefined,
                })) || []),
            ]
            return flattened
        },
        enabled: debounced.trim().length >= 2 && !justSelected,
        staleTime: 1000 * 60 * 5,
    })

    const showDropdown = open && !justSelected && debounced.trim().length >= 2

    return (
        <div ref={containerRef} className="relative w-full">
            <Input
                id={id}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value)
                    setJustSelected(false)
                    setOpen(true)
                }}
                onFocus={() => { if (!justSelected) setOpen(true) }}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                autoComplete="off"
                className={className}
            />
            {showDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-purple-100 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto">
                    {isLoading ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">Buscando...</div>
                    ) : results.length === 0 ? (
                        <div className="py-4 px-3 text-center">
                            <p className="text-xs font-medium">Sin coincidencias</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Continuá escribiendo para crear un nuevo registro.</p>
                        </div>
                    ) : (
                        <ul className="py-1">
                            {results.map((person) => (
                                <li
                                    key={`${person.source}-${person.id}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        onSelect(person)
                                        setJustSelected(true)
                                        setOpen(false)
                                    }}
                                    className="flex items-center justify-between gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={cn(
                                            "p-1.5 rounded-md shrink-0",
                                            person.source === 'profile'
                                                ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
                                                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                        )}>
                                            {person.source === 'profile' ? <User className="h-3.5 w-3.5" /> : <GraduationCap className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                {person.first_name} {person.last_name}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground uppercase tracking-wider italic">
                                                {person.source === 'profile' ? `Líder / ${person.role}` : `Miembro / ${person.department || 'Sin Depto'}`}
                                            </span>
                                        </div>
                                    </div>
                                    {person.assigned_class && (
                                        <Badge variant="outline" className="text-[9px] h-5 bg-slate-50 dark:bg-slate-800 border-slate-200 shrink-0">
                                            {person.assigned_class}
                                        </Badge>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}
