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

    try {
      // Create a single PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      
      // Loop through students to create authorization forms
      for (let i = 0; i < selectedStudents.length; i++) {
        // Create a temporary div for each student's authorization
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
          <div class="auth-form" style="padding: 15px; font-family: Arial, sans-serif; color: #000000; font-size: 14px;">
            <h3 style="text-align: center; font-weight: bold; margin-bottom: 15px; color: #000000; font-size: 16px;">AUTORIZACIÓN PARA SALIDA EDUCATIVA</h3>
            <p style="margin-bottom: 10px; color: #000000;">
              Por medio de la presente, yo, <span style="text-decoration: underline; padding: 0 50px;"></span>, en calidad de padre/madre/tutor del
              menor <strong>${getFullName(selectedStudents[i])}</strong>, autorizo su participación en la salida organizada por la
              congregación, con los siguientes datos:
            </p>
            <ul style="margin-left: 20px; padding-left: 0; list-style-type: none;">
              <li style="margin-bottom: 8px; color: #000000;">• Día de la salida: <strong>${authorizationDetails.departure_date}</strong></li>
              <li style="margin-bottom: 8px; color: #000000;">• Hora de salida: <strong>${authorizationDetails.departure_time}</strong></li>
              <li style="margin-bottom: 8px; color: #000000;">• Lugar de salida: <strong>${authorizationDetails.departure_place}</strong></li>
              <li style="margin-bottom: 8px; color: #000000;">• Lugar de destino: <strong>${authorizationDetails.destination_place}</strong></li>
              <li style="margin-bottom: 8px; color: #000000;">• Hora de regreso: <strong>${authorizationDetails.return_time}</strong></li>
            </ul>
            <p style="margin: 15px 0; color: #000000;">
              Asimismo, autorizo expresamente el uso de fotografías y/o videos en los que el menor aparezca,
              tomados durante dicha salida, para ser publicados en las <strong>redes sociales oficiales de la congregación</strong>
              con fines institucionales y de difusión.
            </p>
            <div style="margin-top: 25px;">
              <p style="margin-bottom: 10px; color: #000000;">Firma del adulto responsable: <span style="text-decoration: underline; padding: 0 100px;"></span></p>
              <p style="margin-bottom: 10px; color: #000000;">Aclaración: <span style="text-decoration: underline; padding: 0 100px;"></span></p>
              <p style="margin-bottom: 10px; color: #000000;">Teléfono de contacto: <span style="text-decoration: underline; padding: 0 100px;"></span></p>
            </div>
          </div>
        `;
        document.body.appendChild(tempDiv);

        // Convert the temp div to canvas with higher quality
        const canvas = await html2canvas(tempDiv, {
          scale: 3, // Higher scale for better quality
          logging: false,
          useCORS: true,
          backgroundColor: "#ffffff"
        });

        // Add image to PDF
        const imgData = canvas.toDataURL('image/png');
        
        // Add new page for each student (except first one)
        if (i > 0) {
          pdf.addPage();
        }
        
        // Add the image to the page
        pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - 2*margin, 0);
        
        // Clean up
        document.body.removeChild(tempDiv);
      }

      // Save the PDF
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
      
      {/* Hidden authorization form template - Kept for reference but no longer used */}
      <div className="hidden">
        <div ref={authFormRef} className="auth-template">
          <div className="auth-form" style={{padding: '20px', fontFamily: 'Arial, sans-serif', color: '#000000'}}>
            <h3 style={{textAlign: 'center', fontWeight: 'bold', marginBottom: '15px', color: '#000000'}}>
              AUTORIZACIÓN PARA SALIDA EDUCATIVA
            </h3>
            <p style={{marginBottom: '10px', color: '#000000'}}>
              Por medio de la presente, yo, ________________________________, en calidad de padre/madre/tutor del
              menor ________________________________, autorizo su participación en la salida organizada por la
              congregación, con los siguientes datos:
            </p>
            <ul style={{marginLeft: '20px', paddingLeft: '0', listStyleType: 'none'}}>
              <li style={{marginBottom: '5px', color: '#000000'}}>• Día de la salida: {authorizationDetails.departure_date}</li>
              <li style={{marginBottom: '5px', color: '#000000'}}>• Hora de salida: {authorizationDetails.departure_time}</li>
              <li style={{marginBottom: '5px', color: '#000000'}}>• Lugar de salida: {authorizationDetails.departure_place}</li>
              <li style={{marginBottom: '5px', color: '#000000'}}>• Lugar de destino: {authorizationDetails.destination_place}</li>
              <li style={{marginBottom: '5px', color: '#000000'}}>• Hora de regreso: {authorizationDetails.return_time}</li>
            </ul>
            <p style={{marginBottom: '10px', color: '#000000'}}>
              Asimismo, autorizo expresamente el uso de fotografías y/o videos en los que el menor aparezca,
              tomados durante dicha salida, para ser publicados en las <strong>redes sociales oficiales de la congregación</strong>
              con fines institucionales y de difusión.
            </p>
            <div style={{marginTop: '20px'}}>
              <p style={{marginBottom: '5px', color: '#000000'}}>Firma del adulto responsable: ________________________________</p>
              <p style={{marginBottom: '5px', color: '#000000'}}>Aclaración: ________________________________</p>
              <p style={{marginBottom: '5px', color: '#000000'}}>Teléfono de contacto: ________________________________</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutorizacionesSalida;
