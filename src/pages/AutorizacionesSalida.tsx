
import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Student, TripAuthorization } from "@/types/database";
import { FileText, Printer, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const AutorizacionesSalida = () => {
  const { profile } = useAuth();
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const authFormRef = useRef<HTMLDivElement>(null);
  
  const [authorizationDetails, setAuthorizationDetails] = useState<TripAuthorization>({
    departure_date: format(new Date(), 'yyyy-MM-dd'),
    departure_time: '',
    departure_place: '',
    destination_place: '',
    return_time: ''
  });

  // Get departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Filter available classes based on selected department
  const availableClasses = selectedDepartment 
    ? departments.find(d => d.id === selectedDepartment)?.classes || []
    : [];

  // Get students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", selectedDepartment, selectedClass],
    queryFn: async () => {
      if (!selectedDepartment) return [];

      let query = supabase
        .from("students")
        .select("*, departments:department_id(name, id)");
      
      query = query.eq("department_id", selectedDepartment);
      
      if (selectedClass) {
        query = query.eq("assigned_class", selectedClass);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || [])
        .map(student => ({
          ...student,
          department: student.departments?.name
        }))
        .sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name || ''}`;
          const nameB = `${b.first_name} ${b.last_name || ''}`;
          return nameA.localeCompare(nameB);
        });
    },
    enabled: Boolean(selectedDepartment),
  });

  // Update selected students when selectAll changes
  useEffect(() => {
    if (selectAll) {
      setSelectedStudents(students);
    } else {
      setSelectedStudents([]);
    }
  }, [selectAll, students]);

  // Department change handler
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSelectedClass(null);
    setSelectAll(false);
    setSelectedStudents([]);
  };

  // Class change handler
  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectAll(false);
    setSelectedStudents([]);
  };

  // Handle student selection
  const handleStudentSelectionChange = (student: Student) => {
    setSelectedStudents(prevSelected => {
      const isSelected = prevSelected.some(s => s.id === student.id);
      
      if (isSelected) {
        return prevSelected.filter(s => s.id !== student.id);
      } else {
        return [...prevSelected, student];
      }
    });
  };

  // Toggle select all
  const handleSelectAllChange = () => {
    setSelectAll(!selectAll);
  };

  // Handle authorization detail changes
  const handleAuthDetailChange = (field: keyof TripAuthorization, value: string) => {
    setAuthorizationDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Format department name
  const formatDepartment = (dept?: string) => {
    if (!dept) return "No asignado";
    return dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get full name
  const getFullName = (student: Student): string => {
    return student.last_name 
      ? `${student.first_name} ${student.last_name}` 
      : student.first_name;
  };

  // Generate PDF for the authorizations
  const generatePDF = async () => {
    if (selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona al menos un estudiante para generar autorizaciones",
        variant: "destructive"
      });
      return;
    }

    if (!authFormRef.current) return;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availableWidth = pdfWidth - 2 * margin;
      const authHeight = 140; // Approximate height of each authorization in mm

      for (let i = 0; i < selectedStudents.length; i++) {
        // Create a temporary div for each student's authorization
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
          <div class="auth-form" style="padding: 10px; font-family: Arial, sans-serif;">
            <h3 style="text-align: center; font-weight: bold; margin-bottom: 10px;">AUTORIZACIÓN PARA SALIDA EDUCATIVA</h3>
            <p style="margin-bottom: 8px;">
              Por medio de la presente, yo, ________________________________, en calidad de padre/madre/tutor del
              menor ${getFullName(selectedStudents[i])}, autorizo su participación en la salida organizada por la
              congregación, con los siguientes datos:
            </p>
            <ul style="margin-left: 20px; padding-left: 0; list-style-type: none;">
              <li style="margin-bottom: 5px;">• Día de la salida: ${authorizationDetails.departure_date}</li>
              <li style="margin-bottom: 5px;">• Hora de salida: ${authorizationDetails.departure_time}</li>
              <li style="margin-bottom: 5px;">• Lugar de salida: ${authorizationDetails.departure_place}</li>
              <li style="margin-bottom: 5px;">• Lugar de destino: ${authorizationDetails.destination_place}</li>
              <li style="margin-bottom: 5px;">• Hora de regreso: ${authorizationDetails.return_time}</li>
            </ul>
            <p style="margin-bottom: 8px;">
              Asimismo, autorizo expresamente el uso de fotografías y/o videos en los que el menor aparezca,
              tomados durante dicha salida, para ser publicados en las <strong>redes sociales oficiales de la congregación</strong>
              con fines institucionales y de difusión.
            </p>
            <div style="margin-top: 15px;">
              <p style="margin-bottom: 5px;">Firma del adulto responsable: ________________________________</p>
              <p style="margin-bottom: 5px;">Aclaración: ________________________________</p>
              <p style="margin-bottom: 5px;">Teléfono de contacto: ________________________________</p>
            </div>
          </div>
        `;
        document.body.appendChild(tempDiv);

        // Convert the temp div to canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          logging: false,
          useCORS: true
        });

        // Calculate positioning for 2 authorizations per page
        const imgData = canvas.toDataURL('image/png');
        if (i % 2 === 0) {
          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imgData, 'PNG', margin, margin, availableWidth, authHeight);
        } else {
          pdf.addImage(imgData, 'PNG', margin, margin + authHeight, availableWidth, authHeight);
        }

        // Remove the temp div
        document.body.removeChild(tempDiv);
      }

      pdf.save('autorizaciones_salida.pdf');
      
      toast({
        title: "Éxito",
        description: `Se han generado ${selectedStudents.length} autorizaciones`,
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al generar el PDF. Inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Autorizaciones para Salidas Educativas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Estudiantes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="department-filter">Departamento</Label>
                  <Select
                    value={selectedDepartment || undefined}
                    onValueChange={handleDepartmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {formatDepartment(dept.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDepartment && availableClasses.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="class-filter">Clase</Label>
                    <Select
                      value={selectedClass || undefined}
                      onValueChange={handleClassChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las clases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las clases</SelectItem>
                        {availableClasses.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <Checkbox 
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAllChange}
                />
                <Label htmlFor="select-all" className="cursor-pointer">
                  Seleccionar todos
                </Label>
                <div className="ml-auto text-sm text-muted-foreground">
                  {selectedStudents.length} estudiantes seleccionados
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Clase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          Cargando...
                        </TableCell>
                      </TableRow>
                    ) : students.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          No hay estudiantes disponibles
                        </TableCell>
                      </TableRow>
                    ) : (
                      students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.some(s => s.id === student.id)}
                              onCheckedChange={() => handleStudentSelectionChange(student)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{getFullName(student)}</TableCell>
                          <TableCell>{formatDepartment(student.department)}</TableCell>
                          <TableCell>{student.assigned_class || "No asignado"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalles de la Salida</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="departure-date">Día de la salida</Label>
                  <Input 
                    id="departure-date"
                    type="date"
                    value={authorizationDetails.departure_date}
                    onChange={(e) => handleAuthDetailChange('departure_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departure-time">Hora de salida</Label>
                  <Input 
                    id="departure-time"
                    type="time"
                    value={authorizationDetails.departure_time}
                    onChange={(e) => handleAuthDetailChange('departure_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departure-place">Lugar de salida</Label>
                  <Input 
                    id="departure-place"
                    value={authorizationDetails.departure_place}
                    onChange={(e) => handleAuthDetailChange('departure_place', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination-place">Lugar de destino</Label>
                  <Input 
                    id="destination-place"
                    value={authorizationDetails.destination_place}
                    onChange={(e) => handleAuthDetailChange('destination_place', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="return-time">Hora de regreso</Label>
                  <Input 
                    id="return-time"
                    type="time"
                    value={authorizationDetails.return_time}
                    onChange={(e) => handleAuthDetailChange('return_time', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={generatePDF} 
                className="w-full"
                disabled={selectedStudents.length === 0 || 
                  !authorizationDetails.departure_date ||
                  !authorizationDetails.departure_time ||
                  !authorizationDetails.departure_place ||
                  !authorizationDetails.destination_place ||
                  !authorizationDetails.return_time}
              >
                <Download className="mr-2 h-4 w-4" />
                Generar autorizaciones ({selectedStudents.length})
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Hidden authorization form template */}
      <div className="hidden">
        <div ref={authFormRef} className="auth-template">
          <div className="auth-form" style={{padding: '20px', fontFamily: 'Arial, sans-serif'}}>
            <h3 style={{textAlign: 'center', fontWeight: 'bold', marginBottom: '15px'}}>
              AUTORIZACIÓN PARA SALIDA EDUCATIVA
            </h3>
            <p style={{marginBottom: '10px'}}>
              Por medio de la presente, yo, ________________________________, en calidad de padre/madre/tutor del
              menor ________________________________, autorizo su participación en la salida organizada por la
              congregación, con los siguientes datos:
            </p>
            <ul style={{marginLeft: '20px', paddingLeft: '0', listStyleType: 'none'}}>
              <li style={{marginBottom: '5px'}}>• Día de la salida: {authorizationDetails.departure_date}</li>
              <li style={{marginBottom: '5px'}}>• Hora de salida: {authorizationDetails.departure_time}</li>
              <li style={{marginBottom: '5px'}}>• Lugar de salida: {authorizationDetails.departure_place}</li>
              <li style={{marginBottom: '5px'}}>• Lugar de destino: {authorizationDetails.destination_place}</li>
              <li style={{marginBottom: '5px'}}>• Hora de regreso: {authorizationDetails.return_time}</li>
            </ul>
            <p style={{marginBottom: '10px'}}>
              Asimismo, autorizo expresamente el uso de fotografías y/o videos en los que el menor aparezca,
              tomados durante dicha salida, para ser publicados en las <strong>redes sociales oficiales de la congregación</strong>
              con fines institucionales y de difusión.
            </p>
            <div style={{marginTop: '20px'}}>
              <p style={{marginBottom: '5px'}}>Firma del adulto responsable: ________________________________</p>
              <p style={{marginBottom: '5px'}}>Aclaración: ________________________________</p>
              <p style={{marginBottom: '5px'}}>Teléfono de contacto: ________________________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutorizacionesSalida;
