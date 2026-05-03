import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FileUp, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { importUsersFromExcel, getDepartments } from "@/lib/api";
import { Department, AppRole } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

interface BulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
    open,
    onOpenChange,
    onSuccess,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const { profile } = useAuth();

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const depts = await getDepartments();
                setDepartments(depts);
            } catch (err) {
                console.error("Error fetching departments for template:", err);
            }
        };
        fetchDepts();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    setError("El archivo está vacío o no tiene el formato correcto.");
                    return;
                }

                const formatDateForDB = (dateStr: any): string => {
                    if (!dateStr) return "";

                    if (dateStr instanceof Date) {
                        return dateStr.toISOString().split('T')[0];
                    }

                    const str = dateStr.toString().trim();
                    const parts = str.split(/[-/]/);

                    if (parts.length === 3) {
                        // Check if it's DD-MM-YYYY
                        if (parts[2].length === 4) {
                            const day = parts[0].padStart(2, '0');
                            const month = parts[1].padStart(2, '0');
                            const year = parts[2];
                            return `${year}-${month}-${day}`;
                        }
                        // Check if it's YYYY-MM-DD
                        if (parts[0].length === 4) {
                            return str;
                        }
                    }
                    return str;
                };

                // Map column names (support common variations)
                const mappedData = json.map((row: any) => {
                    const rawBirthdate = row["Fecha Nacimiento (DD-MM-AAAA)"] || row["Fecha Nacimiento"] || row.birthdate || row.FechaNacimiento || "";
                    return {
                        first_name: row.Nombre || row.nombre || row.FirstName,
                        last_name: row.Apellido || row.apellido || row.LastName || "",
                        email: row.Email || row.email || row.Correo,
                        role: (row.Rol || row.rol || row.Role || "maestro").toLowerCase(),
                        department: row.Departamento || row.departamento || row.Department,
                        document_number: row.DNI || row.dni || row["Documento"] || null,
                        address: row.Dirección || row.direccion || row.Address || null,
                        birthdate: formatDateForDB(rawBirthdate) || null,
                        assigned_class: "", // Always empty now, will be assigned in app
                        company_id: profile?.company_id
                    };
                });

                // Validate basic requirements
                const missingData = mappedData.some(u => !u.first_name || !u.email);
                if (missingData) {
                    setError("Algunas filas no tienen Nombre o Email. Por favor revisa el archivo.");
                }

                setPreviewData(mappedData);
            } catch (err) {
                console.error("Error parsing Excel:", err);
                setError("Error al leer el archivo. Asegúrate de que es un Excel válido.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setIsLoading(true);
        try {
            const response = await importUsersFromExcel(previewData);
            const results = response.results || [];
            const successful = results.filter((r: any) => r.success).length;
            const failed = results.filter((r: any) => !r.success).length;

            toast({
                title: "Importación completada",
                description: `Se han creado ${successful} usuarios exitosamente${failed > 0 ? ` y fallaron ${failed}` : ""}.`,
                variant: failed > 0 ? "destructive" : "success",
            });

            if (successful > 0) {
                onSuccess();
                setFile(null);
                setPreviewData([]);
                onOpenChange(false);
            }
        } catch (err: any) {
            toast({
                title: "Error de importación",
                description: err.message || "Hubo un problema al procesar la carga masiva.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Plantilla Usuarios");

        // Set Headers
        sheet.columns = [
            { header: "Nombre", key: "first_name", width: 20 },
            { header: "Apellido", key: "last_name", width: 20 },
            { header: "Email", key: "email", width: 30 },
            { header: "Rol", key: "role", width: 15 },
            { header: "Departamento", key: "department", width: 20 },
            { header: "DNI", key: "document_number", width: 15 },
            { header: "Dirección", key: "address", width: 30 },
            { header: "Fecha Nacimiento (DD-MM-AAAA)", key: "birthdate", width: 25 }
        ];

        // Validation lists logic
        const getFilteredRoles = (userRole: string | undefined): string[] => {
            if (userRole === 'director' || userRole === 'vicedirector') {
                return ['maestro', 'colaborador', 'ayudante'];
            }
            if (userRole === 'director_general') {
                return ['maestro', 'colaborador', 'ayudante', 'director', 'vicedirector'];
            }
            // For admin or others, return all possible roles
            return ["admin", "lider", "director", "director_general", "maestro", "secretaria", "secr.-calendario", "colaborador", "ayudante", "vicedirector", "conserje"];
        };

        const getFilteredDepartments = (userRole: string | undefined, userDepts: string[] | undefined): Department[] => {
            if (userRole === 'admin' || userRole === 'secretaria') {
                return departments;
            }
            if (!userDepts || userDepts.length === 0) {
                return departments;
            }
            return departments.filter(d => userDepts.includes(d.name));
        };

        const roles = getFilteredRoles(profile?.role);
        const filteredDepts = getFilteredDepartments(profile?.role, profile?.departments);
        const deptNames = filteredDepts.map(d => d.name);

        // Add example row with exactly the strings currently in the file
        sheet.addRow({
            first_name: "Ejemplo Nombre",
            last_name: "Ejemplo Apellido",
            email: "ejemplo@correo.com",
            role: "maestro",
            department: deptNames[0] || "adolescentes",
            document_number: "12345678",
            address: "Calle Falsa 123",
            birthdate: "01-01-2000"
        });

        // Ensure lists are not empty for validation formulae
        const deptsForFormula = deptNames.length > 0 ? deptNames : ["adolescentes"];
        const allClasses = Array.from(new Set(departments.flatMap(d => d.classes || [])));
        const classesForFormula = ["Ninguna", ...(allClasses.length > 0 ? allClasses : ["central"])];

        // Excel JS strings for formulae (must be comma separated values inside double quotes if not referencing cells)
        const rolesFormula = `"${roles.join(',')}"`;
        const deptsFormula = `"${deptsForFormula.join(',')}"`;

        // Apply validation to the first 100 rows
        for (let i = 2; i <= 101; i++) {
            // Rol (Column 4)
            sheet.getCell(i, 4).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [rolesFormula]
            };
            // Departamento (Column 5)
            sheet.getCell(i, 5).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [deptsFormula]
            };
        }

        // Style header
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8E8FF' } // Light purple
        };

        // Reference sheet as backup
        const refSheet = workbook.addWorksheet("Lista_de_Opciones");
        refSheet.columns = [
            { header: "CATEGORIA", key: "cat", width: 30 },
            { header: "VALOR", key: "val", width: 30 }
        ];

        refSheet.addRow({ cat: "ROLES PERMITIDOS", val: "" });
        roles.forEach(role => refSheet.addRow({ cat: "", val: role }));
        refSheet.addRow({ cat: "", val: "" });
        refSheet.addRow({ cat: "DEPARTAMENTOS Y CLASES", val: "" });
        departments.forEach(dept => {
            refSheet.addRow({ cat: dept.name, val: "(Departamento)" });
            dept.classes?.forEach(cls => refSheet.addRow({ cat: "", val: cls }));
            refSheet.addRow({ cat: "", val: "" });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "plantilla_importacion_usuarios.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);

        toast({
            title: "Plantilla descargada",
            description: "El Excel ahora solo contiene los campos principales. Podrás asignar las clases luego desde la app.",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 glass-card border-none shadow-2xl">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <DialogTitle className="text-3xl font-black text-foreground flex items-center gap-3">
                            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-purple-500/20">
                                <FileSpreadsheet className="h-6 w-6" />
                            </div>
                            Carga Masiva de Usuarios
                        </DialogTitle>
                        <Button
                            onClick={downloadTemplate}
                            className="rounded-xl border border-purple-200 bg-white dark:bg-slate-900 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 gap-2 h-9 px-4 hidden sm:flex shadow-sm transition-all"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Descargar Plantilla
                        </Button>
                    </div>
                    <DialogDescription className="text-muted-foreground pt-2">
                        Sube un archivo Excel con las columnas: <span className="font-bold text-primary">Nombre, Apellido, Email, Rol, Departamento</span>.
                        Podrás asignar las clases individualmente después de la creación.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 transition-all hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
                        <Input
                            id="excel-upload"
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isLoading}
                        />
                        <Label
                            htmlFor="excel-upload"
                            className="flex flex-col items-center gap-3 cursor-pointer"
                        >
                            <div className="h-14 w-14 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center text-purple-600">
                                <FileUp className="h-7 w-7" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-slate-700 dark:text-slate-200">
                                    {file ? file.name : "Seleccionar archivo Excel"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Arrastra aquí o haz clic para buscar
                                </p>
                            </div>
                        </Label>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400">
                            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {previewData.length > 0 && !error && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-bold flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Previsualización ({previewData.length} usuarios)
                                </h4>
                            </div>
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                                <Table>
                                    <TableHeader className="bg-slate-100/50 dark:bg-slate-800/50">
                                        <TableRow>
                                            <TableHead className="font-bold">Nombre</TableHead>
                                            <TableHead className="font-bold">Email</TableHead>
                                            <TableHead className="font-bold">Rol</TableHead>
                                            <TableHead className="font-bold">Depto.</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.slice(0, 10).map((u, i) => (
                                            <TableRow key={i} className="text-sm">
                                                <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                                                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                                <TableCell className="capitalize">{u.role}</TableCell>
                                                <TableCell className="text-xs">{u.department || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                        {previewData.length > 10 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4 italic">
                                                    ... y {previewData.length - 10} usuarios más
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-8 gap-3 sm:gap-0">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                        className="rounded-xl font-bold"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isLoading || previewData.length === 0 || !!error}
                        className="rounded-xl px-8 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold shadow-lg shadow-purple-500/20"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            "Iniciar Importación"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
