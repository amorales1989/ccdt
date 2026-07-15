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
            className={`bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all duration-300 group flex flex-col justify-between ${isSingleCard ? 'w-full max-w-md mx-auto' : 'w-full'} min-h-[170px] sm:min-h-[220px]`}
            onClick={onClick}
        >
            <div className="mb-4 sm:mb-8 text-center text-slate-800 dark:text-slate-100">
                <h3 className="text-base sm:text-xl font-bold mb-1 truncate">{className}</h3>
                <div className="flex items-center justify-center sm:justify-between sm:px-2">
                    <div className="flex items-baseline justify-center gap-1.5 sm:gap-2">
                        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                            {stats.total}
                        </span>
                        <span className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wide">Miembros</span>
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
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between text-xs sm:text-sm font-bold text-slate-500 px-1">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2 h-2 shrink-0 rounded-full bg-indigo-500"></div>
                        <span className="whitespace-nowrap">Masculino</span>
                        <span className="ml-auto sm:ml-0 text-slate-700 dark:text-slate-300">{stats.male}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2 h-2 shrink-0 rounded-full bg-fuchsia-400"></div>
                        <span className="whitespace-nowrap">Femenino</span>
                        <span className="ml-auto sm:ml-0 text-slate-700 dark:text-slate-300">{stats.female}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
