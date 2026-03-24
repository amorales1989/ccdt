import React from 'react';
import { Tooltip as MuiTooltip, TooltipProps, Zoom, styled } from '@mui/material';

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
    <MuiTooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
    [`& .MuiTooltip-tooltip`]: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // slate-900 with strong opacity
        color: '#fff',
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '8px 12px',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    [`& .MuiTooltip-arrow`]: {
        color: 'rgba(15, 23, 42, 0.95)',
    },
}));

interface CustomTooltipProps extends Omit<TooltipProps, 'title' | 'children'> {
    title: React.ReactNode;
    children: React.ReactElement;
    placement?: TooltipProps['placement'];
    arrow?: boolean;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
    title,
    children,
    placement = "bottom",
    arrow = true,
    ...props
}) => {
    return (
        <StyledTooltip
            title={title}
            placement={placement}
            arrow={arrow}
            TransitionComponent={Zoom}
            enterDelay={200}
            leaveDelay={0}
            {...props}
        >
            {children}
        </StyledTooltip>
    );
};
