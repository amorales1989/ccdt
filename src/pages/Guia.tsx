import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Home, Users, ClipboardList, History, FileText, BookOpen, FolderUp,
  BarChart3, ClipboardCheck, FolderIcon, Wallet, UserRound, Megaphone,
  Wrench, Settings, FileOutput, Search, HelpCircle, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { DEFAULT_PERMISSIONS } from "@/lib/rolePermissions";

type GuideItem = {
  title: string;
  url?: string;
  icon: any;
  color: string;
  what: string;
  uses: string[];
};

// Clave de permiso de menú por pantalla (las que no figuran son visibles para todos).
const MENU_KEY: Record<string, string> = {
  "Todos los Miembros": "menu_todos_miembros",
  "Lista de Miembros": "menu_lista_miembros",
  "Material Didáctico": "menu_material",
  "Informes de Personal": "menu_informes",
  "Tomar Asistencia": "menu_asistencia",
  "Autorizaciones": "menu_autorizaciones",
  "Promover Miembros": "menu_promover",
  "Historial": "menu_historial",
  "Estadísticas": "menu_estadisticas",
  "Registro de Temas": "menu_registro_temas",
  "Departamentos": "menu_departamentos",
  "Contabilidad": "menu_contabilidad",
  "Gestión de Usuarios": "menu_gestion_usuarios",
  "Notificaciones": "menu_notificaciones",
  "Solicitar Reparación": "menu_mantenimiento",
  "Configuración": "menu_configuracion",
};

// Recorrido completo del menú: qué hace y el paso a paso de cada acción.
const SECTIONS: GuideItem[] = [
  {
    title: "Inicio",
    url: "/",
    icon: Home,
    color: "bg-purple-100 text-purple-600",
    what: "Es el panel principal: apenas entrás ves el resumen del día de tu congregación y accesos rápidos a lo más usado.",
    uses: [
      "Mirá las tarjetas superiores: cada departamento muestra la cantidad de miembros y la proporción masculino/femenino.",
      "Usá las flechas laterales (‹ ›) para pasar entre los departamentos cuando hay varios.",
      "En la barra de arriba escribí en «Buscar miembro de la congregación» para encontrar a cualquier persona al instante (admin y secretaría).",
      "Si hay reparaciones pendientes, aparece el botón naranja arriba; tocalo para ir directo a Mantenimiento.",
      "En «Próximos Eventos» ves la agenda; con «+ Agregar Evento» creás uno nuevo sin salir del inicio.",
      "A la derecha, «Resumen de Congregación» muestra métricas rápidas: total de miembros, nuevos del mes, menores de 18 y personal.",
    ],
  },
  {
    title: "Todos los Miembros",
    url: "/todos-los-miembros",
    icon: Users,
    color: "bg-slate-100 text-slate-700",
    what: "Vista global de todas las personas de la congregación, sin importar el departamento. Ideal para buscar a alguien cuando no sabés en qué clase está.",
    uses: [
      "Usá el buscador para filtrar por nombre o apellido mientras escribís.",
      "Abrí el desplegable «Todos los departamentos» para ver solo el departamento que te interesa.",
      "Abrí el desplegable de género (Masculino / Femenino) para acotar el listado.",
      "Tocá una persona de la lista para ver su ficha con los datos completos.",
      "Usá el botón «Agregar Miembro» para cargar a alguien nuevo desde esta misma pantalla.",
    ],
  },
  {
    title: "Lista de Miembros",
    url: "/listar",
    icon: Users,
    color: "bg-blue-100 text-blue-600",
    what: "Es la pantalla central para administrar a las personas de tu departamento y clase: editar datos, generar reportes y exportar.",
    uses: [
      "Elegí el departamento (y la clase, si corresponde) en los filtros de arriba para ver solo ese grupo.",
      "Usá «Agregar Nuevo Miembro» para cargar a una persona directamente desde esta pantalla.",
      "Usá «Importar Miembros desde Excel» para dar de alta a muchas personas de una sola vez a partir de una planilla.",
      "Tocá el menú de tres puntos (⋮) de una persona para abrir las acciones: editar, eliminar o promover.",
      "En «Editar Miembro» modificás nombre, apellido, género, fecha de nacimiento, número de documento (DNI), teléfono, dirección, departamento y clase; guardá al finalizar.",
      "En «Departamentos del miembro» asignás los departamentos secundarios (además del principal): así la persona aparece y recibe avisos en más de un departamento.",
      "Marcá el estado «Autorizado» o «Nuevo» desde las etiquetas de cada miembro.",
      "Abrí «Reportes» → «Generar reporte» para crear la matriz de asistencia o el reporte de actividad.",
      "Usá los botones de exportación para bajar la lista a Excel o generar un PDF.",
      "Para mover personas, seleccionalas y usá «Promover»: elegí el departamento y la clase destino.",
    ],
  },
  {
    title: "Calendario",
    url: "/calendario",
    icon: FileText,
    color: "bg-orange-100 text-orange-600",
    what: "La agenda de eventos de la congregación. Los departamentos solicitan eventos y la secretaría los aprueba.",
    uses: [
      "Recorré el calendario para ver los eventos ya programados.",
      "Si sos admin o secretaría, usá «Agregar Evento» para crear uno: cargá título, fecha, hora y descripción.",
      "Si sos de un departamento, en lugar de crear, enviás una «Solicitud» de evento para que la apruebe la secretaría.",
      "La secretaría revisa las solicitudes pendientes y las aprueba o rechaza; al aprobar, el evento queda publicado.",
      "Tocá un evento existente para ver su detalle.",
    ],
  },
  {
    title: "Material Didáctico",
    url: "/material",
    icon: BookOpen,
    color: "bg-emerald-100 text-emerald-600",
    what: "Repositorio de archivos (PDF y otros) para que los maestros tengan el material de las clases siempre a mano.",
    uses: [
      "Usá el botón de subir para cargar un archivo nuevo desde tu dispositivo.",
      "Poné un nombre claro al material antes de confirmar la subida (es un campo requerido).",
      "Tocá un archivo de la lista para descargarlo.",
      "Usá el ícono de eliminar para borrar el material que ya no se usa.",
    ],
  },
  {
    title: "Informes de Personal",
    url: "/informes",
    icon: Users,
    color: "bg-purple-100 text-purple-600",
    what: "Canal para redactar informes dirigidos a la dirección. Los directores ven un contador con los informes sin leer.",
    uses: [
      "Tocá el botón para redactar un nuevo informe de personal y escribí el contenido.",
      "Guardá el informe; queda disponible para la dirección.",
      "Para corregir uno ya enviado, abrilo y usá «Editar».",
      "Cuando un director lo revisa, lo marca como leído y baja el contador de pendientes.",
      "Usá el ícono de eliminar (con confirmación) para borrar un informe.",
    ],
  },
  {
    title: "Tomar Asistencia",
    url: "/asistencia",
    icon: ClipboardList,
    color: "bg-teal-100 text-teal-600",
    what: "Registro de la asistencia del día para tu departamento o clase. Es la acción más frecuente de maestros y líderes.",
    uses: [
      "Verificá arriba que estén seleccionados el departamento y la clase correctos.",
      "Recorré la lista y marcá a cada miembro como presente o ausente.",
      "Mirá los contadores de Presentes, Ausentes y Total, que se actualizan a medida que marcás.",
      "Cuando termines, tocá «Guardar» para registrar la asistencia de la fecha.",
      "Si no aparece nadie, revisá que el departamento/clase tenga miembros cargados.",
    ],
  },
  {
    title: "Autorizaciones",
    url: "/autorizaciones",
    icon: FileOutput,
    color: "bg-red-100 text-red-600",
    what: "Centro de documentos para actividades. Desde acá generás y descargás las autorizaciones listas para firmar.",
    uses: [
      "Elegí «Autorización de Campamento» para generar el PDF de un campamento (cargás los datos de la actividad).",
      "Elegí «Autorización de Salidas» para generar el PDF de una salida.",
      "Elegí «Ficha de Salud» para descargar la ficha médica y completarla a mano.",
      "Completá los datos que pide cada formulario y descargá o imprimí el documento resultante.",
    ],
  },
  {
    title: "Promover Miembros",
    url: "/promover",
    icon: FolderUp,
    color: "bg-pink-100 text-pink-600",
    what: "Herramienta para mover miembros de un departamento o clase a otro, típicamente al cambio de ciclo o de edad.",
    uses: [
      "Elegí el departamento y la clase de origen («Mostrando miembros de…») para ver a quién podés mover.",
      "Tildá los miembros que querés promover (o seleccioná todos).",
      "Definí el «Departamento destino» y, si aplica, la «Clase destino» (podés dejar la clase opcional).",
      "Si corresponde, usá «Autorizar para departamento» para dejar al miembro autorizado en el grupo nuevo al promoverlo.",
      "Confirmá la promoción; los miembros quedan reasignados al nuevo departamento y clase.",
    ],
  },
  {
    title: "Historial",
    url: "/historial",
    icon: History,
    color: "bg-indigo-100 text-indigo-600",
    what: "Consulta de todas las asistencias registradas, para revisar o corregir cargas anteriores.",
    uses: [
      "Filtrá por fecha, departamento o clase para encontrar el registro que buscás.",
      "Revisá cada fila: miembro, estado (presente/ausente), fecha, departamento y clase.",
      "Para corregir un dato, abrí la asistencia y editá el estado; se guarda al confirmar.",
      "Para borrar la carga de un día, usá eliminar; te pide confirmación («¿Eliminar la asistencia de esta fecha?»).",
    ],
  },
  {
    title: "Estadísticas",
    url: "/estadisticas",
    icon: BarChart3,
    color: "bg-indigo-100 text-indigo-600",
    what: "Panel de gráficos para analizar cómo evoluciona la asistencia y la composición de la congregación.",
    uses: [
      "Usá el filtro «Todas las clases» para enfocar el análisis en una clase puntual.",
      "En «Evolución anual» / «Crecimiento de Membresía» ves cómo cambió la asistencia y la cantidad de miembros mes a mes (con selector de período, ej. últimos 6 meses).",
      "En «Demografía» analizás la distribución por género, grupos de edad y edades exactas.",
      "En «Composición» ves cómo se reparte el grupo.",
      "En «Equipo» / «Roles Ministeriales» ves el reparto por roles (líderes, maestros, etc.).",
      "Consultá la «Tasa global» y la «Tasa de Asistencia», con los bloques de «Resumen» y «Detalle» para los números finos.",
    ],
  },
  {
    title: "Registro de Temas",
    url: "/registro-temas",
    icon: ClipboardCheck,
    color: "bg-lime-100 text-lime-600",
    what: "Bitácora del tema dado en cada clase, con firma del responsable.",
    uses: [
      "Tocá «Nuevo registro de tema» para cargar la clase del día.",
      "Completá el tema dictado y los datos que pide el formulario.",
      "Firmá en el recuadro de firma antes de guardar.",
      "Para corregir un registro, abrilo y usá «Editar».",
      "Usá eliminar (con confirmación «¿Eliminar registro?») para borrar uno cargado por error.",
    ],
  },
  {
    title: "Departamentos",
    url: "/departamentos",
    icon: FolderIcon,
    color: "bg-amber-100 text-amber-600",
    what: "Administración de los departamentos de la congregación y de las clases que tiene cada uno.",
    uses: [
      "Tocá el botón de crear para agregar un departamento nuevo.",
      "Definí el nombre y las clases que lo componen.",
      "Para cambiar algo, usá «Editar» sobre el departamento y actualizá nombre o clases.",
      "Usá eliminar para quitar un departamento que ya no se usa (confirmá la acción).",
    ],
  },
  {
    title: "Contabilidad",
    url: "/contabilidad",
    icon: Wallet,
    color: "bg-green-100 text-green-600",
    what: "Control de ingresos y egresos por departamento, con saldo siempre actualizado.",
    uses: [
      "Elegí el departamento cuyo dinero querés administrar.",
      "Definí el «Saldo inicial» la primera vez, para que el cálculo arranque correcto.",
      "Tocá «Nuevo movimiento» para registrar un ingreso o un egreso: cargá monto, fecha y detalle.",
      "Para corregir, abrí el movimiento y usá «Editar movimiento».",
      "Usá eliminar (con confirmación «¿Eliminar movimiento?») para borrar una carga.",
      "Mirá el saldo del departamento, que se recalcula con cada movimiento.",
    ],
  },
  {
    title: "Gestión de Usuarios",
    url: "/gestion-usuarios",
    icon: UserRound,
    color: "bg-violet-100 text-violet-600",
    what: "Administración de las cuentas de quienes usan el sistema (líderes, maestros, secretaría, etc.).",
    uses: [
      "Tocá «Nuevo» para crear un usuario: cargá sus datos y su rol.",
      "Asigná uno o más departamentos y las clases que va a atender.",
      "Para reasignar, editá el usuario y cambiá departamento/clase; podés usar «Limpiar clases» para empezar de cero.",
      "Revisá la columna «Asignaciones» para ver de un vistazo qué tiene cada usuario.",
      "Usá eliminar para dar de baja una cuenta que ya no se usa.",
    ],
  },
  {
    title: "Notificaciones",
    url: "/notificaciones",
    icon: Megaphone,
    color: "bg-pink-100 text-pink-600",
    what: "Envío de mensajes masivos a la congregación, segmentando a quién le llega.",
    uses: [
      "Elegí el «Canal»: notificación push (a la app) o WhatsApp.",
      "Definí el «Destino»: toda la congregación, un departamento, una clase, ciertos roles o personas puntuales.",
      "Si elegís personas, usá el buscador para sumarlas una por una.",
      "Escribí el mensaje y revisalo bien (los envíos masivos no se pueden deshacer).",
      "Tocá enviar; vas a ver la confirmación «Notificación enviada».",
    ],
  },
  {
    title: "Solicitar Reparación",
    url: "/mantenimiento",
    icon: Wrench,
    color: "bg-orange-100 text-orange-600",
    what: "Pedidos de mantenimiento y reparaciones del edificio. El conserje los ve y los va resolviendo.",
    uses: [
      "Tocá el botón para registrar una nueva reparación y describí el problema.",
      "Confirmá; el pedido queda listado como pendiente.",
      "A medida que avanza, actualizá el estado del pedido.",
      "Cuando está resuelto, podés eliminarlo o dejarlo como histórico.",
      "El conserje ve el resumen de pedidos directamente en su pantalla de Inicio.",
    ],
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    color: "bg-slate-100 text-slate-600",
    what: "Ajustes generales de la congregación y del sistema. Es la pantalla de administración avanzada.",
    uses: [
      "Editá el «Nombre de la Congregación» y activá «Mostrar nombre y logo» para que tu marca aparezca en el menú lateral.",
      "Subí el «Logotipo Institucional» desde tu dispositivo (ves la vista previa) o eliminá el logo actual.",
      "Activá «Notificaciones» para habilitar los avisos y alertas del sistema.",
      "Definí la «Línea de encabezado» que se imprime en los documentos y PDFs de autorizaciones.",
      "Conectá WhatsApp escaneando el código QR con el teléfono de la congregación.",
      "Probá la integración: cargá un «Teléfono de Prueba» y un «Mensaje personalizado», y enviá para verificar que WhatsApp quedó conectado.",
      "Ejecutá manualmente el «Cron de Cumpleaños» para forzar el aviso de cumpleaños del día sin esperar al horario automático.",
      "Configurá la «Contraseña maestra» (nueva + confirmación) para las acciones protegidas.",
      "En «Permisos por Rol» / «Visibilidad de Menú» decidís qué opciones ve cada tipo de usuario.",
    ],
  },
];

const Guia = () => {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });

  // Solo las pantallas que el usuario logueado puede ver en el menú.
  const visibleSections = useMemo(() => {
    const role = profile?.role || '';
    const selectedDepartment = typeof window !== 'undefined' ? localStorage.getItem('selectedDepartment') : null;
    const userDepartment = profile?.departments?.[0] || selectedDepartment;
    const savedPerms = (company as any)?.role_permissions?.[role];
    const allowed = (key?: string) => {
      if (!key) return true;
      if (savedPerms && key in savedPerms) return savedPerms[key] !== false;
      return DEFAULT_PERMISSIONS[role]?.[key] !== false;
    };
    return SECTIONS.filter(s => {
      if (role === 'conserje') return ["Inicio", "Calendario", "Solicitar Reparación"].includes(s.title);
      if (userDepartment === 'calendario') return ["Inicio", "Calendario"].includes(s.title);
      // Autorizaciones: oculto para líderes salvo en adolescentes (igual que el menú)
      if (s.title === "Autorizaciones" && role === "lider" && userDepartment !== "adolescentes") return false;
      return allowed(MENU_KEY[s.title]);
    });
  }, [profile?.role, profile?.departments, company]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return visibleSections;
    return visibleSections.filter(s =>
      s.title.toLowerCase().includes(t) ||
      s.what.toLowerCase().includes(t) ||
      s.uses.some(u => u.toLowerCase().includes(t))
    );
  }, [q, visibleSections]);

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-pink-600 to-rose-600 px-6 md:px-10 pt-10 pb-12 rounded-3xl mb-6">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-pink-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Centro de ayuda</p>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none flex items-center gap-2">
            <HelpCircle className="h-8 w-8" /> Guía de Uso
          </h1>
          <p className="text-pink-100 mt-2 text-sm font-medium">
            Qué hace y cómo se usa cada opción del menú. Tocá una sección para ver el paso a paso.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 px-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar una pantalla o función…"
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-10">No se encontraron resultados.</p>
      ) : (
        <Accordion type="single" collapsible className="space-y-2 px-1">
          {filtered.map((s) => (
            <AccordionItem
              key={s.title}
              value={s.title}
              className="border border-border rounded-2xl px-4 bg-card shadow-sm"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${s.color}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-sm text-foreground">{s.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{s.what}</p>

                <p className="text-xs font-black uppercase tracking-wider text-primary mb-2">Paso a paso</p>
                <ol className="space-y-2 mb-3">
                  {s.uses.map((u, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed flex-1">{u}</span>
                    </li>
                  ))}
                </ol>
                {s.url && (
                  <button
                    onClick={() => navigate(s.url!)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 px-3 py-2 rounded-xl transition-colors"
                  >
                    Ir a {s.title} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default Guia;
