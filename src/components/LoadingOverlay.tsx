import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
    message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = "Cargando datos..." }) => {
    return (
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
        </div>
    );
};
