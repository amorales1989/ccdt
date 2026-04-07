
import * as React from "react"
import { Check, ChevronsUpDown, Search, User, GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/integrations/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { getPersistentCompanyId } from "@/contexts/CompanyContext"

export type PersonSearchResult = {
    id: string
    profile_id?: string
    first_name: string
    last_name: string
    email?: string
    role?: string
    source: 'profile' | 'student'
    department?: string
    assigned_class?: string
    gender?: string
    birthdate?: string
    address?: string
    document_number?: string
    phone?: string
}

interface PersonSearchInputProps {
    onSelect: (person: PersonSearchResult) => void
    placeholder?: string
    className?: string
}

export function PersonSearchInput({ onSelect, placeholder = "Buscar por nombre o apellido...", className }: PersonSearchInputProps) {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")

    const { data: results = [], isLoading } = useQuery({
        queryKey: ['person-search', searchValue],
        queryFn: async () => {
            if (searchValue.length < 2) return []

            const term = `%${searchValue}%`

            // Search profiles
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .or(`first_name.ilike.${term},last_name.ilike.${term},document_number.ilike.${term}`)
                .eq('company_id', getPersistentCompanyId())
                .limit(5) as { data: any[], error: any }

            // Search students
            const { data: students, error: sError } = await supabase
                .from('students')
                .select('*')
                .or(`first_name.ilike.${term},last_name.ilike.${term},document_number.ilike.${term}`)
                .eq('company_id', getPersistentCompanyId())
                .limit(5) as { data: any[], error: any }

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
                    phone: p.phone || undefined
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
                    phone: s.phone || undefined
                })) || [])
            ]

            return flattened
        },
        enabled: searchValue.length >= 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    return (
        <div className={cn("w-full", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 font-normal hover:bg-slate-100 transition-all text-muted-foreground"
                    >
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                            <span>{placeholder}</span>
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full min-w-[300px] p-0 rounded-2xl shadow-2xl border-purple-100 dark:border-slate-800 overflow-hidden" align="start">
                    <Command className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                        <CommandInput
                            placeholder="Escribe para buscar..."
                            value={searchValue}
                            onValueChange={setSearchValue}
                            className="h-12 border-none focus:ring-0"
                        />
                        <CommandList className="max-h-[300px]">
                            <CommandEmpty>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                        Cargando...
                                    </div>
                                ) : searchValue.length < 2 ? (
                                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                        Escriba al menos 2 letras
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                                        <p className="text-sm font-medium">No se encontraron resultados</p>
                                        <p className="text-xs text-muted-foreground mt-1">Puedes continuar escribiendo el nombre para crear un nuevo registro.</p>
                                    </div>
                                )}
                            </CommandEmpty>
                            <CommandGroup>
                                {results.map((person) => (
                                    <CommandItem
                                        key={`${person.source}-${person.id}`}
                                        value={`${person.first_name} ${person.last_name}`}
                                        onSelect={() => {
                                            onSelect(person)
                                            setOpen(false)
                                        }}
                                        className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 data-[selected=true]:bg-purple-50 dark:data-[selected=true]:bg-purple-900/20"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                person.source === 'profile' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                                            )}>
                                                {person.source === 'profile' ? <User className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white leading-tight">
                                                    {person.first_name} {person.last_name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
                                                    {person.source === 'profile' ? `Líder / ${person.role}` : `Miembro / ${person.department || 'Sin Depto'}`}
                                                </span>
                                            </div>
                                        </div>
                                        {person.assigned_class && (
                                            <Badge variant="outline" className="text-[9px] h-5 bg-slate-50 dark:bg-slate-800 border-slate-200">
                                                {person.assigned_class}
                                            </Badge>
                                        )}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}
