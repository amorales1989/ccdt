import React from "react";
import { PersonStanding } from "lucide-react";

interface ClassStats {
    male: number;
    female: number;
    total: number;
}

interface ClassStatsCardProps {
    className: string;
    stats: ClassStats;
    onClick: () => void;
    isSingleCard?: boolean;
}

export function ClassStatsCard({ className, stats, onClick, isSingleCard }: ClassStatsCardProps) {
    const malePercent = stats.total > 0 ? (stats.male / stats.total) * 100 : 0;
    const femalePercent = stats.total > 0 ? (stats.female / stats.total) * 100 : 0;

    return (
        <div
            className={`bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all duration-300 group flex flex-col justify-between ${isSingleCard ? 'w-full max-w-md mx-auto' : 'w-full'} min-h-[220px]`}
            onClick={onClick}
        >
            <div className="mb-8 text-center text-slate-800 dark:text-slate-100">
                <h3 className="text-xl font-bold mb-1">{className}</h3>
                <div className="flex items-center justify-center sm:justify-between px-2">
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">
                            {stats.total}
                        </span>
                        <span className="text-sm font-semibold text-slate-500 uppercase">Miembros</span>
                    </div>
                    <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <PersonStanding className="h-6 w-6" />
                    </div>
                </div>
            </div>

            <div className="space-y-3 mt-auto">
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-1000"
                        style={{ width: `${malePercent}%` }}
                    ></div>
                    <div
                        className="h-full bg-fuchsia-400 transition-all duration-1000"
                        style={{ width: `${femalePercent}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-500 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span>Masculino {stats.male}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400"></div>
                        <span>Femenino {stats.female}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
