import React from "react";
import { LucideIcon } from "lucide-react";

interface TabOption<T extends string = string> {
    value: T;
    label: React.ReactNode;
    icon?: LucideIcon;
}

interface CustomTabsProps<T extends string = string> {
    value: T;
    onChange: (value: T) => void;
    options: TabOption<T>[];
    className?: string;
    scrollable?: boolean;
}

export const CustomTabs = <T extends string = string>({
    value,
    onChange,
    options,
    className = "",
    scrollable = false,
}: CustomTabsProps<T>) => {
    return (
        <div
            className={`
                bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-md
                p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50
                w-full ${scrollable ? "overflow-x-auto" : "overflow-hidden"}
                ${className}
            `}
        >
            <div className={`flex gap-1 ${scrollable ? "w-max min-w-full" : ""}`}>
                {options.map((option) => {
                    const selected = option.value === value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => onChange(option.value)}
                            className={`
                                ${scrollable ? "shrink-0 px-4" : "flex-1 min-w-0"}
                                inline-flex items-center justify-center gap-2 h-10 rounded-xl
                                text-sm font-semibold whitespace-nowrap transition-all duration-200
                                ${selected
                                    ? "bg-white text-purple-600 shadow-sm dark:bg-slate-800 dark:text-purple-400"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}
                            `}
                        >
                            {option.icon && <option.icon className="h-4 w-4 shrink-0" />}
                            <span className="truncate">{option.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
