import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getMaterials, createMaterial, deleteMaterial, getDepartments } from "@/lib/api";
import { MaterialDidactico, Department } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import imageCompression from 'browser-image-compression';
import axios from 'axios';
import { useIsMobile } from "@/hooks/use-mobile";
import {
    Plus, Download, Trash2, FileText, Search,
    Filter, BookOpen, Loader2, UploadCloud,
    Signal, MoreVertical, FileDown, Calendar,
    ExternalLink, Trash, Edit, FileSpreadsheet,
    X, ImageIcon
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CustomTooltip } from "@/components/CustomTooltip";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";

const Material = () => {
    const { profile } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [materials, setMaterials] = useState<MaterialDidactico[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [statusText, setStatusText] = useState("");
    const [uploadSpeed, setUploadSpeed] = useState<string>("");
    const [selectedPreview, setSelectedPreview] = useState<MaterialDidactico | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form state
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newAge, setNewAge] = useState("");
    const [newDept, setNewDept] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Filters
    const [filterDept, setFilterDept] = useState<string>("all");
    const [filterAge, setFilterAge] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    const canUpload = ["admin", "director", "director_general", "vicedirector", "secretaria"].includes(profile?.role || "");

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const depts = await getDepartments();
            setDepartments(depts || []);
            const mats = await getMaterials();
            setMaterials(Array.isArray(mats) ? mats : []);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: "Error", description: "No se pudieron cargar los materiales", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const loadMaterials = async () => {
        try {
            const params: any = {};
            if (filterDept !== "all") params.department_id = filterDept;
            if (filterAge !== "all") params.age_range = filterAge;
            const mats = await getMaterials(params);
            setMaterials(Array.isArray(mats) ? mats : []);
        } catch (error) {
            console.error("Error loading materials:", error);
        }
    };

    useEffect(() => {
        loadMaterials();
    }, [filterDept, filterAge]);

    const handleUpload = async () => {
        if (!selectedFile || !newName || !newAge) {
            toast({ title: "Requerido", description: "Completa los campos obligatorios", variant: "destructive" });
            return;
        }

        const MAX_SIZE = 50 * 1024 * 1024;
        if (selectedFile.size > MAX_SIZE) {
            toast({ title: "Error", description: "Límite 50MB.", variant: "destructive" });
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setStatusText("Iniciando...");
        setUploadSpeed("");

        const startTime = Date.now();

        try {
            let fileToUpload = selectedFile;
            if (selectedFile.type.startsWith('image/')) {
                setStatusText("Comprimiendo...");
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
                fileToUpload = await imageCompression(selectedFile, options);
            }

            setStatusText("Subiendo...");
            const fileExt = fileToUpload.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `materials/${fileName}`;

            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await axios.post(
                `${supabaseUrl}/storage/v1/object/material-didactico/${filePath}`,
                fileToUpload,
                {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'apikey': supabaseAnonKey,
                        'Content-Type': fileToUpload.type
                    },
                    onUploadProgress: (progressEvent) => {
                        const total = progressEvent.total || fileToUpload.size;
                        const current = progressEvent.loaded;
                        const percent = Math.round((current / total) * 100);
                        setUploadProgress(percent);
                        const elapsedSeconds = (Date.now() - startTime) / 1000;
                        const kbps = (current / 1024) / (elapsedSeconds || 1);
                        setUploadSpeed(`${(kbps / 1024).toFixed(2)} MB/s`);
                    }
                }
            );

            const storagePath = response.data.Key || response.data.path || filePath;
            setStatusText("Guardando...");

            await createMaterial({
                name: newName,
                description: newDesc,
                file_url: storagePath.includes('/') ? storagePath.split('/').slice(1).join('/') : storagePath,
                age_range: newAge,
                department_id: (newDept && newDept !== "none") ? newDept : undefined,
                file_size: selectedFile.size
            });

            toast({ title: "Éxito", description: "Material publicado" });
            setIsUploadOpen(false);
            resetForm();
            fetchInitialData();
            setUploading(false);
        } catch (error) {
            console.error("Upload error:", error);
            toast({ title: "Error de subida", description: "Verifica tu conexión", variant: "destructive" });
            setUploading(false);
        }
    };

    const resetForm = () => {
        setNewName(""); setNewDesc(""); setNewAge(""); setNewDept(""); setSelectedFile(null);
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setMaterialToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!materialToDelete) return;
        setIsDeleting(true);
        try {
            await deleteMaterial(materialToDelete);
            setMaterials(materials.filter(m => m.id !== materialToDelete));
            toast({ title: "Eliminado", description: "Material borrado correctamente" });
        } catch (error) {
            toast({ title: "Error", description: "No se pudo borrar", variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setMaterialToDelete(null);
        }
    };

    const getPublicUrl = (path: string) => {
        const cleanPath = path.startsWith('material-didactico/') ? path.replace('material-didactico/', '') : path;
        const { data } = supabase.storage.from('material-didactico').getPublicUrl(cleanPath);
        return data.publicUrl;
    };

    const filteredMaterials = (materials || []).filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderActionIcons = (material: MaterialDidactico) => {
        const publicUrl = getPublicUrl(material.file_url);

        if (isMobile) {
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(publicUrl, '_blank')}>
                            <Download className="mr-2 h-4 w-4" /> Bajar
                        </DropdownMenuItem>
                        {canUpload && (
                            <DropdownMenuItem className="text-destructive" onClick={(e) => handleDelete(material.id, e)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Borrar
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        }

        return (
            <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                <CustomTooltip title="Ver / Descargar">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary transition-colors" onClick={() => window.open(publicUrl, '_blank')}>
                        <Download className="h-4 w-4" />
                    </Button>
                </CustomTooltip>

                {canUpload && (
                    <CustomTooltip title="Eliminar">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive transition-colors" onClick={(e) => handleDelete(material.id, e)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </CustomTooltip>
                )}
            </div>
        );
    };

    const isImage = (url: string) => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(url);
    const isPDF = (url: string) => /\.pdf$/i.test(url);

    const getFileIcon = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase();
        if (isImage(url)) return null;
        if (ext === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
        if (['xlsx', 'xls', 'csv'].includes(ext || '')) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
        if (['doc', 'docx'].includes(ext || '')) return <FileText className="h-5 w-5 text-blue-600" />;
        return <FileText className="h-5 w-5 text-slate-400" />;
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            <DeleteConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={confirmDelete}
                isLoading={isDeleting}
                title="¿Eliminar este material?"
                description="Esta acción eliminará el archivo de forma permanente de la biblioteca."
            />
            {/* Modal de Carga */}
            {uploading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <Card className="w-[350px] border-none shadow-2xl rounded-[40px] flex flex-col items-center justify-center p-10 gap-6 border border-primary/10">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full border-4 border-primary/5 border-t-primary animate-spin" />
                            <UploadCloud className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-primary animate-pulse" />
                        </div>
                        <div className="text-center space-y-4 w-full">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary uppercase italic">{statusText}</h3>
                                <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    <Signal className="h-3 w-3" />
                                    {uploadSpeed || "Calculando..."}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black text-primary uppercase tracking-widest">
                                    <span>Subiendo</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <Progress value={uploadProgress} className="h-3 rounded-full bg-primary/10" />
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* PREVIEW MODAL */}
            <Dialog open={!!selectedPreview} onOpenChange={(open) => !open && setSelectedPreview(null)}>
                <DialogContent className="sm:max-w-[80vw] sm:max-h-[90vh] overflow-hidden p-0 rounded-[20px] border-none shadow-2xl">
                    {selectedPreview && (
                        <div className="flex flex-col h-full bg-slate-950 text-white">
                            <div className="p-4 flex items-center justify-between border-b border-white/10">
                                <div className="flex flex-col">
                                    <h2 className="text-sm font-black uppercase tracking-tight">{selectedPreview.name}</h2>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold text-primary">{selectedPreview.age_range} AÑOS — {selectedPreview.departments?.name || "GENERAL"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10 rounded-full" onClick={() => setSelectedPreview(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-900/50">
                                {isImage(selectedPreview.file_url) ? (
                                    <img src={getPublicUrl(selectedPreview.file_url)} alt={selectedPreview.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                                ) : isPDF(selectedPreview.file_url) ? (
                                    <iframe src={getPublicUrl(selectedPreview.file_url)} className="w-full h-[70vh] rounded-lg border-none" title="PDF Preview" />
                                ) : (
                                    <div className="flex flex-col items-center gap-4 py-20">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                                            <FileText className="h-10 w-10 text-slate-400" />
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay vista previa disponible para este formato</p>
                                        <Button className="bg-white text-slate-950 hover:bg-white/90 rounded-full font-black px-8" onClick={() => window.open(getPublicUrl(selectedPreview.file_url), '_blank')}>DESCARGAR AHORA</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* HEADER PRO - SEGÚN SCREENSHOT */}
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Material Didáctico</h1>
                    <p className="text-slate-500 font-medium text-xs">Gestión de recursos y material educativo</p>
                </div>

                <div className="flex items-center gap-2">
                    {canUpload && (
                        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg px-6 h-10 text-xs font-bold gap-2 shadow-lg transition-all active:scale-95">
                                    <Plus className="h-4 w-4" />
                                    Cargar Material
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] rounded-[30px] border-none shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Publicar Recurso</DialogTitle>
                                    <DialogDescription className="text-slate-500 font-medium">Añade un nuevo material a la biblioteca escolar.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-6 py-6">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título del Material</Label>
                                        <Input
                                            value={newName}
                                            onChange={e => setNewName(e.target.value.toUpperCase())}
                                            placeholder="EJ: GUÍA DE APRENDIZAJE #1"
                                            className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold text-slate-700"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción (Opcional)</Label>
                                        <Input
                                            value={newDesc}
                                            onChange={e => setNewDesc(e.target.value)}
                                            placeholder="Breve descripción del contenido..."
                                            className="h-12 bg-slate-50 border-slate-100 rounded-xl font-medium text-slate-600"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rango de Edad</Label>
                                            <Select value={newAge} onValueChange={setNewAge}>
                                                <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold uppercase text-xs">
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="0-3">CUNA (0-3)</SelectItem>
                                                    <SelectItem value="4-6">PÁRVULOS (4-6)</SelectItem>
                                                    <SelectItem value="7-9">PRIMARIOS (7-9)</SelectItem>
                                                    <SelectItem value="10-12">INTERMEDIOS (10-12)</SelectItem>
                                                    <SelectItem value="13-17">ADOLESCENTES</SelectItem>
                                                    <SelectItem value="18+">ADULTOS</SelectItem>
                                                    <SelectItem value="todas">TODAS</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Departamento</Label>
                                            <Select value={newDept} onValueChange={setNewDept}>
                                                <SelectTrigger className="h-12 bg-slate-50 border-slate-100 rounded-xl font-bold uppercase text-xs">
                                                    <SelectValue placeholder="General" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">GENERAL</SelectItem>
                                                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name.toUpperCase()}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Archivo (Máx 50MB)</Label>
                                        <div className="relative group">
                                            <Input
                                                type="file"
                                                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                                className="h-20 bg-primary/5 border-dashed border-2 border-primary/20 rounded-2xl cursor-pointer file:hidden text-transparent transition-colors group-hover:bg-primary/10"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none gap-3">
                                                <UploadCloud className="h-6 w-6 text-primary animate-bounce" />
                                                <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">
                                                    {selectedFile ? selectedFile.name : "Click o arrastra para subir"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={handleUpload}
                                        className="w-full h-12 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
                                        disabled={uploading}
                                    >
                                        {uploading ? <Loader2 className="animate-spin" /> : "Publicar Ahora"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* TABLA PRO - SEGÚN SCREENSHOT */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex flex-wrap items-center gap-4 bg-slate-50/20">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input placeholder="Nombre..." className="pl-10 h-9 bg-white border-slate-200 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>

                    <Select value={filterAge} onValueChange={setFilterAge}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold border-slate-200 uppercase">
                            <SelectValue placeholder="Edades" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">TODAS LAS EDADES</SelectItem>
                            <SelectItem value="0-3">CUNA (0-3)</SelectItem>
                            <SelectItem value="4-6">PÁRVULOS (4-6)</SelectItem>
                            <SelectItem value="7-9">PRIMARIOS (7-9)</SelectItem>
                            <SelectItem value="10-12">INTERMEDIOS (10-12)</SelectItem>
                            <SelectItem value="13-17">ADOLESCENTES</SelectItem>
                            <SelectItem value="18+">ADULTOS</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterDept} onValueChange={setFilterDept}>
                        <SelectTrigger className="w-[140px] h-9 text-xs font-bold border-slate-200 uppercase">
                            <SelectValue placeholder="Deptos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">TODOS LOS DEPTOS</SelectItem>
                            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name.toUpperCase()}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[60px] pl-6 font-bold text-slate-800 py-4 text-[11px] uppercase tracking-wider">Vista</TableHead>
                                <TableHead className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Nombre</TableHead>
                                <TableHead className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Tipo</TableHead>
                                <TableHead className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Departamento</TableHead>
                                <TableHead className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Edad</TableHead>
                                <TableHead className="text-right font-bold text-slate-800 pr-10 text-[11px] uppercase tracking-wider">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                            ) : filteredMaterials.map((material) => (
                                <TableRow key={material.id} className="border-b border-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer" onClick={() => setSelectedPreview(material)}>
                                    <TableCell className="pl-6 py-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200 shadow-sm">
                                            {isImage(material.file_url) ? (
                                                <img
                                                    src={getPublicUrl(material.file_url)}
                                                    alt="Preview"
                                                    className="w-full h-full object-cover transition-transform hover:scale-110"
                                                />
                                            ) : (
                                                getFileIcon(material.file_url)
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 text-sm tracking-tight uppercase">{material.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-black text-[9px] uppercase tracking-tighter rounded-md h-5">
                                            {material.file_url.split('.').pop()?.toUpperCase() || "??? "}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-3 text-slate-500 font-medium text-xs">
                                        {material.departments?.name?.toUpperCase() || "GENERAL"}
                                    </TableCell>
                                    <TableCell className="py-3 text-slate-500 font-medium text-xs">
                                        {material.age_range.toUpperCase()}
                                    </TableCell>
                                    <TableCell className="py-3 text-right pr-6">
                                        {renderActionIcons(material)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {!loading && filteredMaterials.length === 0 && (
                <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest italic text-xs">
                    No hay recursos disponibles
                </div>
            )}
        </div>
    );
};

export default Material;
