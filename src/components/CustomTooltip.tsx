import React from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

type Placement =
    | 'top' | 'bottom' | 'left' | 'right'
    | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
    | 'left-start' | 'left-end' | 'right-start' | 'right-end';

interface CustomTooltipProps {
    title: React.ReactNode;
    children: React.ReactElement;
    placement?: Placement;
    /** Se acepta por compatibilidad con los ~40 usos previos; Radix siempre dibuja flecha. */
    arrow?: boolean;
    className?: string;
}

/** Cuánto queda abierto el tooltip tras un toque, antes de cerrarse solo. */
const MS_VISIBLE_EN_TACTIL = 2500;

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
    title,
    children,
    placement = 'bottom',
    className,
}) => {
    // Radix solo abre con hover/foco: en celular los tooltips quedaban inaccesibles
    // (MUI los abría con toque largo). Varias pantallas los usan como única forma de
    // leer texto truncado, así que en táctil se abren al tocar y se cierran solos.
    const [open, setOpen] = React.useState(false);
    const timer = React.useRef<number>();

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    const alTocar = (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        setOpen(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(false), MS_VISIBLE_EN_TACTIL);
    };

    // MUI no renderiza nada con title vacío; se mantiene ese comportamiento. Va después
    // de los hooks para no cambiar su cantidad entre renders.
    if (title === null || title === undefined || title === '') return children;

    const [side, align] = placement.split('-') as [
        'top' | 'bottom' | 'left' | 'right',
        'start' | 'end' | undefined,
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip open={open} onOpenChange={setOpen}>
                {/* Sin preventDefault: el onClick propio del hijo (botones, links) sigue andando. */}
                <TooltipTrigger asChild onPointerDown={alTocar}>
                    {children}
                </TooltipTrigger>
                <TooltipContent
                    side={side}
                    align={align ?? 'center'}
                    collisionPadding={8}
                    className={
                        'max-w-xs border border-white/10 bg-slate-900/95 px-3 py-2 text-xs ' +
                        'font-medium text-white shadow-lg backdrop-blur-sm ' + (className ?? '')
                    }
                >
                    {title}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};
