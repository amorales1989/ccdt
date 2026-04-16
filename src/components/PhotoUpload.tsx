import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Upload, User, X } from "lucide-react";
import { uploadStudentPhoto, deleteStudentPhoto } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface PhotoUploadProps {
    studentId: string;
    currentPhotoUrl?: string | null;
    onUploadSuccess: (newUrl: string | null) => void;
    firstName: string;
    lastName?: string | null;
    gender?: string;
}

export const PhotoUpload = ({
    studentId,
    currentPhotoUrl,
    onUploadSuccess,
    firstName,
    lastName,
    gender
}: PhotoUploadProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Error",
                description: "Por favor selecciona un archivo de imagen válido.",
                variant: "destructive",
            });
            return;
        }

        // Validar tamaño (aunque el back lo comprime, limitamos el upload inicial a 10MB)
        if (file.size > 10 * 1024 * 1024) {
            toast({
                title: "Error",
                description: "La imagen es demasiado grande. Máximo 10MB.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsUploading(true);
            const result = await uploadStudentPhoto(studentId, file);

            const newUrl = result.data?.photo_url || result.photo_url;
            if (newUrl) {
                onUploadSuccess(newUrl);
                toast({
                    title: "Éxito",
                    description: "Foto actualizada correctamente.",
                    variant: "success",
                });
            }
        } catch (error: any) {
            console.error("Error uploading photo:", error);
            toast({
                title: "Error al subir",
                description: error.message || "No se pudo subir la foto.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDeletePhoto = async () => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar la foto de este miembro?")) return;

        try {
            setIsUploading(true);
            await deleteStudentPhoto(studentId);
            onUploadSuccess(null);
            toast({
                title: "Éxito",
                description: "Foto eliminada correctamente.",
                variant: "success",
            });
        } catch (error: any) {
            console.error("Error deleting photo:", error);
            toast({
                title: "Error al eliminar",
                description: error.message || "No se pudo eliminar la foto.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const initials = `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
    const fallbackImage = gender?.toLowerCase() === 'femenino' ? '/avatarM.png' : '/avatarH.png';

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-slate-800 shadow-xl overflow-hidden">
                    <AvatarImage src={currentPhotoUrl || fallbackImage} alt={`${firstName} ${lastName}`} className="object-cover" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                        {initials || <User className="h-12 w-12" />}
                    </AvatarFallback>
                </Avatar>

                {currentPhotoUrl && !isUploading && (
                    <button
                        onClick={handleDeletePhoto}
                        className="absolute -top-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-all scale-100 sm:scale-0 sm:group-hover:scale-100 z-10"
                        title="Eliminar foto"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}

                <button
                    onClick={triggerFileInput}
                    disabled={isUploading}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full disabled:opacity-100 disabled:bg-black/20"
                >
                    {isUploading ? (
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                    ) : (
                        <div className="flex flex-col items-center text-white text-xs font-semibold">
                            <Camera className="h-8 w-8 mb-1" />
                            <span>CAMBIAR</span>
                        </div>
                    )}
                </button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            {!currentPhotoUrl && !isUploading && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={triggerFileInput}
                    className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                    <Upload className="h-4 w-4" />
                    Subir Foto
                </Button>
            )}
        </div>
    );
};
