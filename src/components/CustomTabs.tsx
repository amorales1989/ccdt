import React from "react";
import { Box, Tabs, Tab } from "@mui/material";
import { LucideIcon } from "lucide-react";

interface TabOption {
    value: string;
    label: string;
    icon: LucideIcon;
}

interface CustomTabsProps {
    value: string;
    onChange: (value: string) => void;
    options: TabOption[];
    className?: string;
}

export const CustomTabs = ({ value, onChange, options, className = "" }: CustomTabsProps) => {
    return (
        <Box className={`bg-slate-100/90 dark:bg-slate-800/60 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/50 w-full sm:w-fit overflow-hidden lg:flex-shrink-0 mx-auto lg:mx-0 ${className}`}>
            <Tabs
                value={value}
                onChange={(_, newValue) => onChange(newValue)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    minHeight: 'auto',
                    '& .MuiTabs-indicator': {
                        display: 'none',
                    },
                    '& .MuiTabs-flexContainer': {
                        gap: '8px',
                        justifyContent: 'flex-start',
                        '@media (min-width: 640px)': {
                            justifyContent: 'center',
                        }
                    },
                }}
            >
                {options.map((option) => (
                    <Tab
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        icon={<option.icon className="h-4 w-4" />}
                        iconPosition="start"
                        sx={{
                            minHeight: '44px',
                            borderRadius: '12px',
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            color: 'rgb(100 116 139)',
                            padding: { xs: '0 12px', sm: '0 32px' },
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&.Mui-selected': {
                                backgroundColor: 'white',
                                color: 'rgb(126 34 206)',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                            },
                            '.dark &.Mui-selected': {
                                backgroundColor: 'rgb(147 51 234)',
                                color: 'white',
                            },
                            '&:hover': {
                                opacity: 0.8,
                            }
                        }}
                    />
                ))}
            </Tabs>
        </Box>
    );
};
