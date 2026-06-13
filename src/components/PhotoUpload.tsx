import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Camera, Loader2, Pencil, RotateCcw, RotateCw, Upload, User, X, ZoomIn } from "lucide-react";
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

const VIEWPORT = 288; // lado del recorte cuadrado en px (coincide con el preview)
const OUTPUT_RES = 3; // multiplicador de resolucion de salida

// Recorta el area visible cuadrada aplicando zoom, desplazamiento y rotacion.
// Normaliza la orientacion EXIF y devuelve un nuevo File JPEG.
const cropImageFile = async (
    file: File,
    opts: { zoom: number; offsetX: number; offsetY: number; rotation: number; baseScale: number }
): Promise<File> => {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const out = VIEWPORT * OUTPUT_RES;
    const s = opts.baseScale * opts.zoom * OUTPUT_RES;
    const rad = (opts.rotation % 360) * (Math.PI / 180);

    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out, out);

    ctx.translate(out / 2 + opts.offsetX * OUTPUT_RES, out / 2 + opts.offsetY * OUTPUT_RES);
    ctx.rotate(rad);
    ctx.scale(s, s);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    bitmap.close();

    const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen."))),
            "image/jpeg",
            0.92
        )
    );

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
};

export const PhotoUpload = ({
    studentId,
    currentPhotoUrl,
    onUploadSuccess,
    firstName,
    lastName,
    gender
}: PhotoUploadProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [rotation, setRotation] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [naturalDims, setNaturalDims] = useState({ w: 0, h: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

    // Escala base para que la imagen "cubra" el viewport con zoom = 1.
    const swap = rotation % 180 !== 0;
    const effW = swap ? naturalDims.h : naturalDims.w;
    const effH = swap ? naturalDims.w : naturalDims.h;
    const baseScale = effW && effH ? Math.max(VIEWPORT / effW, VIEWPORT / effH) : 1;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast({ title: "Error", description: "Por favor selecciona un archivo de imagen válido.", variant: "destructive" });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast({ title: "Error", description: "La imagen es demasiado grande. Máximo 10MB.", variant: "destructive" });
            return;
        }

        openEditor(file);
    };

    const closePreview = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setSelectedFile(null);
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) return;

        try {
            setIsUploading(true);
            const fileToUpload = await cropImageFile(selectedFile, {
                zoom,
                offsetX: offset.x,
                offsetY: offset.y,
                rotation,
                baseScale,
            });

            const result = await uploadStudentPhoto(studentId, fileToUpload);
            const newUrl = result.data?.photo_url || result.photo_url;
            if (newUrl) {
                onUploadSuccess(newUrl);
                toast({ title: "Éxito", description: "Foto actualizada correctamente.", variant: "success" });
            }
            closePreview();
        } catch (error: any) {
            console.error("Error uploading photo:", error);
            toast({ title: "Error al subir", description: error.message || "No se pudo subir la foto.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePhoto = async () => {
        if (!window.confirm("¿Estás seguro de que deseas eliminar la foto de este miembro?")) return;
        try {
            setIsUploading(true);
            await deleteStudentPhoto(studentId);
            onUploadSuccess(null);
            toast({ title: "Éxito", description: "Foto eliminada correctamente.", variant: "success" });
        } catch (error: any) {
            console.error("Error deleting photo:", error);
            toast({ title: "Error al eliminar", description: error.message || "No se pudo eliminar la foto.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const triggerFileInput = () => fileInputRef.current?.click();

    const openEditor = (file: File) => {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setRotation(0);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setNaturalDims({ w: 0, h: 0 });
    };

    const handleEditCurrent = async () => {
        if (!currentPhotoUrl) return;
        try {
            setIsUploading(true);
            const res = await fetch(currentPhotoUrl, { cache: "no-store" });
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            openEditor(new File([blob], "foto.jpg", { type: blob.type || "image/jpeg" }));
        } catch {
            toast({ title: "Error", description: "No se pudo cargar la foto para editar.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const startDrag = (clientX: number, clientY: number) => {
        dragRef.current = { startX: clientX, startY: clientY, ox: offset.x, oy: offset.y };
    };
    const moveDrag = (clientX: number, clientY: number) => {
        if (!dragRef.current) return;
        setOffset({
            x: dragRef.current.ox + (clientX - dragRef.current.startX),
            y: dragRef.current.oy + (clientY - dragRef.current.startY),
        });
    };
    const endDrag = () => { dragRef.current = null; };

    const initials = `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
    const fallbackImage = gender?.toLowerCase() === 'femenino' ? '/avatarM.svg' : '/avatarH.svg';

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
                    <>
                        <button
                            onClick={handleDeletePhoto}
                            className="absolute -top-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-all scale-100 sm:scale-0 sm:group-hover:scale-100 z-10"
                            title="Eliminar foto"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={handleEditCurrent}
                            className="absolute -bottom-1 -right-1 bg-indigo-500 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-600 transition-all scale-100 sm:scale-0 sm:group-hover:scale-100 z-10"
                            title="Editar foto (recortar / girar)"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    </>
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

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

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

            <Dialog open={!!previewUrl} onOpenChange={(open) => !open && !isUploading && closePreview()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajustar foto</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-4 py-2">
                        <div
                            className="relative overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 cursor-move touch-none select-none mx-auto"
                            style={{ width: VIEWPORT, height: VIEWPORT, maxWidth: "100%" }}
                            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
                            onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
                            onMouseUp={endDrag}
                            onMouseLeave={endDrag}
                            onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                            onTouchMove={(e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
                            onTouchEnd={endDrag}
                        >
                            {previewUrl && (
                                <img
                                    src={previewUrl}
                                    alt="Previsualización"
                                    draggable={false}
                                    onLoad={(e) => setNaturalDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                                    className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                                    style={{
                                        width: naturalDims.w || "auto",
                                        height: naturalDims.h || "auto",
                                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${baseScale * zoom})`,
                                        transformOrigin: "center",
                                    }}
                                />
                            )}
                            <div className="absolute inset-0 rounded-full ring-2 ring-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)] pointer-events-none" />
                        </div>

                        <div className="flex w-full items-center gap-3 px-2">
                            <ZoomIn className="h-4 w-4 text-slate-500 shrink-0" />
                            <Slider
                                min={1}
                                max={4}
                                step={0.01}
                                value={[zoom]}
                                onValueChange={(v) => setZoom(v[0])}
                                disabled={isUploading}
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isUploading}
                                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>
                                <RotateCcw className="h-4 w-4" /> Girar
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isUploading}
                                onClick={() => setRotation((r) => (r + 90) % 360)}>
                                <RotateCw className="h-4 w-4" /> Girar
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={closePreview} disabled={isUploading}>Cancelar</Button>
                        <Button onClick={handleConfirmUpload} disabled={isUploading} className="gap-2">
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Subir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
