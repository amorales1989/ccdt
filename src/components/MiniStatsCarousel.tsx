import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { format, subMonths, differenceInYears, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Loader2, Users, UserCheck, Baby, TrendingUp } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import { useCompany } from "@/contexts/CompanyContext";

interface MiniStatsCarouselProps {
    students: any[];
    currentProfile: any;
}

const COLORS = ["#002366", "#003a8c", "#0050b3", "#096dd9", "#1890ff", "#40a9ff", "#69c0ff"];
const GLOBAL_ROLES = ["admin", "secretaria", "director_general"];

export function MiniStatsCarousel({ students, currentProfile }: MiniStatsCarouselProps) {
    const isGlobalView = !currentProfile || GLOBAL_ROLES.includes(currentProfile.role);
    const scopedDeptId = isGlobalView ? null : currentProfile?.department_id;

    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: true })
    );
    const { companyId } = useCompany();

    // Fetch Profiles
    const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
        queryKey: ['stats-profiles', scopedDeptId, companyId],
        queryFn: async () => {
            let q = supabase.from('profiles').select('*').eq('company_id', companyId);
            if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
            const { data, error } = await q;
            if (error) throw error;
            return data;
        }
    });

    const data = useMemo(() => {
        if (!students.length) return null;

        // Gender Distribution
        const genderCount = students.reduce((acc: Record<string, number>, s) => {
            const g = s.gender?.toLowerCase() || 'desconocido';
            acc[g] = (acc[g] || 0) + 1;
            return acc;
        }, {});
        const genderData = Object.entries(genderCount).map(([name, value]) => ({
            name: name === 'masculino' ? 'Masculino' : name === 'femenino' ? 'Femenino' : 'Desconocido',
            value
        }));

        // Age Groups
        const ageGroups: Record<string, number> = {
            "0-11 años": 0, "12-17 años": 0, "18-29 años": 0, "30-44 años": 0,
            "45-59 años": 0, "60-79 años": 0, "80+ años": 0, "Sin datos": 0
        };
        students.forEach(s => {
            if (!s.birthdate) { ageGroups["Sin datos"]++; return; }
            try {
                const age = differenceInYears(new Date(), new Date(s.birthdate));
                if (age <= 11) ageGroups["0-11 años"]++;
                else if (age <= 17) ageGroups["12-17 años"]++;
                else if (age <= 29) ageGroups["18-29 años"]++;
                else if (age <= 44) ageGroups["30-44 años"]++;
                else if (age <= 59) ageGroups["45-59 años"]++;
                else if (age <= 79) ageGroups["60-79 años"]++;
                else ageGroups["80+ años"]++;
            } catch { ageGroups["Sin datos"]++; }
        });
        const ageData = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

        // Membership Growth
        const last12Months = Array.from({ length: 12 }, (_, i) => {
            const d = subMonths(new Date(), 11 - i);
            return { monthKey: format(d, 'yyyy-MM'), name: format(d, 'MMM', { locale: es }), count: 0, total: 0 };
        });
        students.forEach(s => {
            if (!s.created_at) return;
            const m = format(new Date(s.created_at), 'yyyy-MM');
            const idx = last12Months.findIndex(lm => lm.monthKey === m);
            if (idx !== -1) last12Months[idx].count++;
        });
        const firstMonthKey = last12Months[0].monthKey;
        let runningTotal = students.filter(s => s.created_at && format(new Date(s.created_at), 'yyyy-MM') < firstMonthKey).length;
        last12Months.forEach(m => { runningTotal += m.count; m.total = runningTotal; });

        // Roles
        const rolesCount = profiles.reduce((acc: Record<string, number>, p) => {
            const r = p.role || 'Otros';
            acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, {});
        const roleData = Object.entries(rolesCount)
            .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
            .sort((a, b) => b.value - a.value);

        // Department distribution
        const deptCount: Record<string, number> = {};
        students.forEach(s => {
            const name = s.departments?.name || s.department || 'Sin depto.';
            deptCount[name] = (deptCount[name] || 0) + 1;
        });
        const deptData = Object.entries(deptCount)
            .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '), value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

        // KPIs
        const total = students.length;
        const newThisMonth = students.filter(s => {
            if (!s.created_at) return false;
            return new Date(s.created_at) >= startOfMonth(new Date());
        }).length;
        const females = students.filter(s => s.gender === 'femenino').length;
        const males = students.filter(s => s.gender === 'masculino').length;
        const minors = students.filter(s => {
            if (!s.birthdate) return false;
            return differenceInYears(new Date(), new Date(s.birthdate)) < 18;
        }).length;

        return { genderData, ageData, last12Months, roleData, deptData, total, newThisMonth, females, males, minors };
    }, [students, profiles]);

    if (loadingProfiles || !data) {
        return (
            <div className="bg-white dark:bg-slate-900/50 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 min-h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    const charts = [
        {
            title: "Resumen de Congregación",
            description: "Métricas generales",
            content: (
                <div className="grid grid-cols-2 gap-3 w-full px-2">
                    {[
                        { icon: Users, label: "Total miembros", value: data.total, color: "bg-blue-50 text-blue-700" },
                        { icon: TrendingUp, label: "Nuevos este mes", value: data.newThisMonth, color: "bg-emerald-50 text-emerald-700" },
                        { icon: Baby, label: "Menores de 18", value: data.minors, color: "bg-violet-50 text-violet-700" },
                        { icon: UserCheck, label: "Personal", value: profiles.length, color: "bg-amber-50 text-amber-700" },
                    ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className={`rounded-2xl p-4 flex flex-col gap-1 ${color}`}>
                            <Icon className="h-4 w-4 opacity-70" />
                            <p className="text-2xl font-black">{value}</p>
                            <p className="text-[10px] font-semibold opacity-70 leading-tight">{label}</p>
                        </div>
                    ))}
                </div>
            )
        },
        {
            title: "Por Departamento",
            description: "Miembros activos por área",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.deptData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={90} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                        <Bar dataKey="value" name="Miembros" fill="#002366" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Crecimiento Mensual",
            description: "Últimos 6 meses",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.last12Months.slice(-6)} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                        <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="total" name="Miembros" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#growthGrad)" dot={{ fill: '#6366f1', r: 4 }} />
                    </AreaChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Género",
            description: "Composición de la congregación",
            content: (
                <div className="flex items-center justify-center gap-8 w-full py-4">
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-3xl font-black text-blue-700">{data.males}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-600">Varones</p>
                        <p className="text-xs text-slate-400">{data.total ? Math.round(data.males / data.total * 100) : 0}%</p>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-2 w-32 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <p className="text-xs text-slate-400 font-semibold">{data.total} total</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <div className="h-24 w-24 rounded-full bg-pink-100 flex items-center justify-center">
                            <span className="text-3xl font-black text-pink-600">{data.females}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-600">Mujeres</p>
                        <p className="text-xs text-slate-400">{data.total ? Math.round(data.females / data.total * 100) : 0}%</p>
                    </div>
                </div>
            )
        },
        {
            title: "Rangos Etarios",
            description: "Distribución por edad",
            content: (
                <div className="w-full space-y-2 px-2 py-1">
                    {data.ageData.filter(d => d.name !== 'Sin datos' && d.value > 0).map(d => (
                        <div key={d.name} className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-500 w-16 shrink-0">{d.name}</span>
                            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full flex items-center justify-end pr-2 transition-all"
                                    style={{ width: `${data.total ? Math.max(6, Math.round(d.value / data.total * 100)) : 0}%` }}
                                >
                                    <span className="text-[9px] font-black text-white">{d.value}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )
        },
    ];

    return (
        <div className="bg-[#f0f4f8] dark:bg-slate-900/50 rounded-[2rem] border-slate-100 dark:border-slate-800 relative group transition-all w-full">
            <Carousel
                plugins={[plugin.current as any]}
                className="w-full"
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
                opts={{
                    loop: true,
                }}
            >
                <CarouselContent>
                    {charts.map((chart, index) => (
                        <CarouselItem key={index}>
                            <div className="p-6">
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center gap-2 mb-1">
                                        <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">{chart.title}</h3>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{chart.description}</p>
                                </div>
                                <div className="w-full flex justify-center items-center">
                                    {chart.content}
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <div className="absolute top-1/2 -translate-y-1/2 left-2 z-10">
                    <CarouselPrevious className="h-8 w-8 relative translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-slate-100 text-slate-800" />
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10">
                    <CarouselNext className="h-8 w-8 relative translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-slate-100 text-slate-800" />
                </div>
            </Carousel>
        </div>
    );
}
