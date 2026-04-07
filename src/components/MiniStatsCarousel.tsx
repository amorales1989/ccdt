import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { format, subMonths, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Loader2 } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import { useCompany } from "@/contexts/CompanyContext";

interface MiniStatsCarouselProps {
    students: any[];
    currentProfile: any;
}

const COLORS = ["#002366", "#003a8c", "#0050b3", "#096dd9", "#1890ff", "#40a9ff", "#69c0ff"];
const GLOBAL_ROLES = ["admin", "secretaria"];

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

        return { genderData, ageData, last12Months, roleData };
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
            title: "Curva de Membresía",
            description: "Evolución acumulada",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.last12Months}>
                        <defs>
                            <linearGradient id="colorTotalMini" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#002366" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#002366" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="total" name="Miembros" stroke="#002366" strokeWidth={3} fillOpacity={1} fill="url(#colorTotalMini)" />
                    </AreaChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Capas Generacionales",
            description: "Distribución etaria",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={30} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                        <Bar dataKey="value" name="Miembros" fill="#002366" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Equilibrio Demográfico",
            description: "Composición por género",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie data={data.genderData} innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                            {data.genderData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    </PieChart>
                </ResponsiveContainer>
            )
        },
        {
            title: "Organigrama Ministerial",
            description: "Distribución de perfiles",
            content: (
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.roleData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={80} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                        <Bar dataKey="value" name="Personal" fill="#002366" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                </ResponsiveContainer>
            )
        }
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
