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
                bg-slate-100/90 dark:bg-slate-800/60 backdrop-blur-md
                p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/50
                w-full sm:w-fit overflow-hidden lg:flex-shrink-0 mx-auto lg:mx-0
                ${className}
            `}
        >
            <Tabs
                value={value}
                onChange={(_, newValue: T) => onChange(newValue)}
                variant="scrollable"
                scrollButtons={false}
                sx={{
                    minHeight: "auto",
                    "& .MuiTabs-indicator": {
                        display: "none",
                    },
                    "& .MuiTabs-flexContainer": {
                        gap: "8px",
                        justifyContent: "flex-start",
                        "@media (min-width: 640px)": {
                            justifyContent: "center",
                        },
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
                            minHeight: "44px",
                            borderRadius: "12px",
                            flexGrow: 1,
                            textTransform: "none",
                            fontWeight: 500,
                            fontSize: { xs: "0.75rem", sm: "0.875rem" },
                            color: "text.secondary",
                            padding: { xs: "0 12px", sm: "0 32px" },
                            transition:
                                "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            "&.Mui-selected": {
                                backgroundColor: "background.paper",
                                color: "secondary.main",
                                boxShadow:
                                    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            },
                            "&:hover:not(.Mui-selected)": {
                                backgroundColor: "action.hover",
                                opacity: 1,
                            },
                        }}
                    />
                ))}
            </Tabs>
        </Box>
    );
};