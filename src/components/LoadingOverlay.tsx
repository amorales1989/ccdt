import React from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "Cargando datos..." }) => {
    // Portal al body: las páginas usan `animate-fade-in`, que deja un transform aplicado
    // (animation-fill-mode: forwards). Un ancestro con transform pasa a ser el bloque de
    // referencia de `position: fixed`, así que el overlay tapaba solo su contenedor y se
    // podía clickear el resto de la pantalla a través del blur.
    return createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/30 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
                {/* Decorative background glow */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />

                <div className="glass-card p-8 flex flex-col items-center gap-4 relative z-10 border-white/20 shadow-2xl scale-110 md:scale-125">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 animate-pulse">
                            {message}
                        </span>
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" />
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
