import React from "react";
import { Box, Tabs, Tab } from "@mui/material";
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
}

export const CustomTabs = <T extends string = string>({
    value,
    onChange,
    options,
    className = "",
}: CustomTabsProps<T>) => {
    return (
        <Box
            className={`
                bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-md
                p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50
                w-full overflow-hidden
                ${className}
            `}
        >
            <Tabs
                value={value}
                onChange={(_, newValue: T) => onChange(newValue)}
                variant="fullWidth"
                sx={{
                    minHeight: "auto",
                    "& .MuiTabs-indicator": {
                        display: "none",
                    },
                    "& .MuiTabs-flexContainer": {
                        gap: "4px",
                    },
                }}
            >
                {options.map((option) => (
                    <Tab
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={
                            option.icon
                                ? React.createElement(option.icon, {
                                    className: "h-4 w-4",
                                })
                                : undefined
                        }
                        iconPosition="start"
                        sx={{
                            minHeight: "40px",
                            borderRadius: "12px",
                            textTransform: "none",
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "text.secondary",
                            transition: "all 0.2s ease-in-out",
                            "&.Mui-selected": {
                                backgroundColor: "white",
                                color: "#7c3aed", // purple-600
                                boxShadow: "0 2px 8px -2px rgba(0,0,0,0.1), 0 1px 4px -1px rgba(0,0,0,0.1)",
                                ".dark &": {
                                    backgroundColor: "#1e293b", // slate-800
                                    color: "#a78bfa", // purple-400
                                }
                            },
                            "&:hover:not(.Mui-selected)": {
                                backgroundColor: "rgba(0,0,0,0.04)",
                                ".dark &": {
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                }
                            },
                        }}
                    />
                ))}
            </Tabs>
        </Box>
    );
};