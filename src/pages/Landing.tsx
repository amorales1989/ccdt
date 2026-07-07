import { useEffect, useState } from "react";
import { enterDemo, DEMO_ROLES, type DemoRole } from "@/lib/demo";
import {
  Users,
  ClipboardList,
  CalendarDays,
  BarChart3,
  FileOutput,
  BookOpen,
  Bell,
  Wrench,
  ShieldCheck,
  Smartphone,
  FolderUp,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  TrendingUp,
  Clock,
  MessageCircle,
  Eye,
  ShieldCheck as ShieldIcon,
} from "lucide-react";

// WhatsApp en formato internacional sin + (54 9 11 5908-0306)
const WHATSAPP_NUMBER = "5491159080306";
const WHATSAPP_MSG = encodeURIComponent(
  "Hola! Estuve viendo Nexus y me interesa mucho para mi organización. Me gustaría conocer más, ¿podemos hablar?"
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/* ----------------------------- UI helpers ----------------------------- */

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("opacity-100", "translate-y-0");
            e.target.classList.remove("opacity-0", "translate-y-6");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const features = [
  {
    icon: ClipboardList,
    title: "Tomar Asistencia",
    desc: "Registrá presentes en segundos, por clase y departamento, desde el celular.",
    color: "from-blue-500 to-blue-700",
  },
  {
    icon: Users,
    title: "Gestión de Miembros",
    desc: "Ficha completa de cada miembro: datos, clase, cumpleaños y trazabilidad.",
    color: "from-indigo-500 to-blue-700",
  },
  {
    icon: BarChart3,
    title: "Estadísticas",
    desc: "Métricas de asistencia y crecimiento en gráficos claros y exportables.",
    color: "from-cyan-500 to-blue-600",
  },
  {
    icon: CalendarDays,
    title: "Calendario de Eventos",
    desc: "Planificá eventos, solicitudes y recordatorios para toda la organización.",
    color: "from-sky-500 to-indigo-600",
  },
  {
    icon: FileOutput,
    title: "Autorizaciones",
    desc: "Permisos de campamento y salidas firmados digitalmente por los padres.",
    color: "from-blue-600 to-violet-600",
  },
  {
    icon: FolderUp,
    title: "Promoción de Miembros",
    desc: "Pasá miembros de clase de forma masiva al cerrar el ciclo, sin errores.",
    color: "from-emerald-500 to-teal-600",
  },
  {
    icon: BookOpen,
    title: "Material Didáctico",
    desc: "Centralizá material de enseñanza accesible para cada maestro.",
    color: "from-amber-500 to-orange-600",
  },
  {
    icon: Bell,
    title: "Notificaciones Push",
    desc: "Avisá a todos al instante, incluso con la app cerrada.",
    color: "from-rose-500 to-pink-600",
  },
  {
    icon: Wrench,
    title: "Mantenimiento",
    desc: "Reportá y seguí reparaciones de las instalaciones en un solo lugar.",
    color: "from-slate-500 to-slate-700",
  },
];

const roles = [
  { label: "Administrador", color: "bg-violet-100 text-violet-700" },
  { label: "Secretaría", color: "bg-blue-100 text-blue-700" },
  { label: "Director", color: "bg-red-100 text-red-700" },
  { label: "Líder", color: "bg-orange-100 text-orange-700" },
  { label: "Maestro", color: "bg-green-100 text-green-700" },
  { label: "Auxiliar", color: "bg-teal-100 text-teal-700" },
  { label: "Conserje", color: "bg-slate-100 text-slate-700" },
];

/* ----------------------------- Mockups ----------------------------- */

function BrowserFrame({ children, title = "nexus.app", flush = false }: { children: React.ReactNode; title?: string; flush?: boolean }) {
  return (
    <div className="rounded-2xl bg-white shadow-large ring-1 ring-slate-200/70 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <span className="h-3 w-3 rounded-full bg-red-400" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-green-400" />
        <div className="ml-3 flex-1 max-w-[220px] rounded-md bg-white border border-slate-200 px-3 py-1 text-[11px] text-slate-400">
          {title}
        </div>
      </div>
      <div className={flush ? "" : "p-5 bg-gradient-to-br from-slate-50 to-white"}>{children}</div>
    </div>
  );
}

function AttendanceMock() {
  return (
    <BrowserFrame title="nexus.app/asistencia" flush>
      <img
        src="/screens/attendance.png"
        alt="Pantalla de Tomar Asistencia de Nexus"
        className="w-full h-auto block"
      />
    </BrowserFrame>
  );
}

function StatsMock() {
  return (
    <BrowserFrame title="nexus.app/estadisticas" flush>
      <img
        src="/screens/stats.png"
        alt="Pantalla de estadísticas de Nexus"
        className="w-full h-auto block"
      />
    </BrowserFrame>
  );
}

function CalendarMock() {
  const events = [
    { t: "Reunión de Líderes", d: "Lun 02", c: "bg-primary" },
    { t: "Campamento de Jóvenes", d: "Vie 06", c: "bg-violet-500" },
    { t: "Clase especial", d: "Sáb 07", c: "bg-emerald-500" },
  ];
  return (
    <BrowserFrame title="nexus.app/calendario">
      <p className="text-base font-semibold text-slate-800 mb-1">Junio 2026</p>
      <p className="text-xs text-slate-400 mb-4">Próximos eventos</p>
      <div className="grid grid-cols-7 gap-1.5 mb-4">
        {Array.from({ length: 28 }).map((_, i) => {
          const active = [1, 5, 6, 18].includes(i);
          return (
            <div
              key={i}
              className={`aspect-square rounded-md grid place-items-center text-[10px] ${
                active ? "bg-primary text-white font-bold" : "bg-slate-50 text-slate-400"
              }`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.t} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
            <span className={`h-9 w-1.5 rounded-full ${e.c}`} />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">{e.t}</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {e.d}
              </p>
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[260px]">
      <div className="rounded-[2.5rem] bg-slate-900 p-3 shadow-large ring-1 ring-slate-800">
        <div className="rounded-[2rem] bg-white overflow-hidden h-[480px]">
          <img
            src="/screens/stats.png"
            alt="Estadísticas de Nexus en el celular"
            className="w-full h-full object-cover object-top"
          />
        </div>
      </div>
      <div className="absolute -right-4 top-24 rounded-2xl bg-white shadow-large px-3 py-2 flex items-center gap-2 ring-1 ring-slate-100 animate-pulse-slow">
        <Bell className="h-4 w-4 text-rose-500" />
        <span className="text-[11px] font-medium text-slate-600">Nuevo evento</span>
      </div>
    </div>
  );
}

/* ----------------------------- Sections ----------------------------- */

function DemoCTA({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-success px-6 py-3 font-semibold text-white shadow-glow transition hover:brightness-110 active:scale-95 ${className}`}
    >
      <WhatsAppIcon className="h-5 w-5" />
      {children}
    </a>
  );
}

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const start = (role: DemoRole) => {
    enterDemo(role);
    window.location.href = "/home";
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-large p-6 animate-scale-in">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-extrabold text-slate-900">Probá la app por dentro</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Elegí un rol y entrá a un entorno con datos de ejemplo. Podés navegar todo;
          los cambios no se guardan.
        </p>
        <div className="space-y-3">
          {DEMO_ROLES.map((r) => (
            <button
              key={r.value}
              onClick={() => start(r.value)}
              className="group w-full text-left rounded-xl border border-slate-200 p-4 transition hover:border-primary hover:bg-blue-50/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{r.label}</p>
                  <p className="text-sm text-slate-500">{r.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition" />
              </div>
            </button>
          ))}
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-slate-400">
          <ShieldIcon className="h-3.5 w-3.5" /> Entorno aislado · solo lectura · datos ficticios
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  useReveal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 antialiased">
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      {/* Fondo decorativo sutil (fijo, muy leve) */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/70 via-white to-violet-50/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-violet-400/[0.05] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(37,99,235,0.07) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(to bottom, black, transparent 70%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 70%)",
          }}
        />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <nav className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2">
            <img src="/fire.png" alt="Nexus" className="h-8 w-8 object-contain" />
            <span className="text-lg font-extrabold tracking-tight">Nexus</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#funciones" className="hover:text-primary transition">Funciones</a>
            <a href="#demos" className="hover:text-primary transition">Demos</a>
            <a href="#roles" className="hover:text-primary transition">Roles</a>
            <a href="#movil" className="hover:text-primary transition">Móvil</a>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" /> Ver demo
            </button>
            <DemoCTA className="!px-4 !py-2 text-sm">Contactanos</DemoCTA>
          </div>
          <button className="md:hidden p-2" onClick={() => setMenuOpen((v) => !v)} aria-label="Menú">
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 px-5 py-4 flex flex-col gap-4 text-sm font-medium text-slate-600">
            <a href="#funciones" onClick={() => setMenuOpen(false)}>Funciones</a>
            <a href="#demos" onClick={() => setMenuOpen(false)}>Demos</a>
            <a href="#roles" onClick={() => setMenuOpen(false)}>Roles</a>
            <a href="#movil" onClick={() => setMenuOpen(false)}>Móvil</a>
            <button
              onClick={() => { setMenuOpen(false); setDemoOpen(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700"
            >
              <Eye className="h-4 w-4" /> Ver demo en vivo
            </button>
            <DemoCTA className="!py-2.5">Contactanos</DemoCTA>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.04]" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-5 pt-10 pb-12 grid lg:grid-cols-2 gap-12 items-center">
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-primary text-xs font-semibold px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5" /> La plataforma todo-en-uno para tu organización
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900">
              Gestioná tu congregación{" "}
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                sin papeles
              </span>
            </h1>
            <p className="mt-5 text-lg text-slate-500 max-w-lg">
              Asistencia, miembros, eventos, autorizaciones y estadísticas en una sola app.
              Rápida, móvil y pensada para cada rol de tu equipo.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-white shadow-glow transition hover:bg-primary-700 active:scale-95"
              >
                <Eye className="h-5 w-5" /> Ver demo en vivo
              </button>
              <DemoCTA className="text-base !px-7 !py-3.5">Contactanos</DemoCTA>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Sin instalación</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Funciona en el celular</span>
            </div>
          </div>
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 delay-150">
            <StatsMock />
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-slate-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-5 py-5 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "9+", l: "Módulos integrados" },
            { v: "100%", l: "En la nube y PWA" },
            { v: "7", l: "Roles configurables" },
            { v: "<30s", l: "Para tomar asistencia" },
          ].map((s) => (
            <div key={s.l} data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
              <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">{s.v}</p>
              <p className="mt-1 text-sm text-slate-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funciones" className="max-w-6xl mx-auto px-5 py-10">
        <div className="text-center max-w-2xl mx-auto" data-reveal>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Todo lo que tu organización necesita
          </h2>
          <p className="mt-3 text-slate-500">
            Reemplazá planillas, grupos de chat y papeles por una plataforma única.
          </p>
        </div>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              data-reveal
              className="opacity-0 translate-y-6 transition-all duration-700 group rounded-2xl border border-slate-100 bg-white p-6 hover:shadow-medium hover:-translate-y-1"
              style={{ transitionDelay: `${(i % 3) * 80}ms` }}
            >
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center text-white shadow-soft group-hover:scale-110 transition`}>
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demos alternating */}
      <section id="demos" className="bg-slate-50/60 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-10 space-y-12">
          {/* Demo 1 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 order-2 lg:order-1">
              <AttendanceMock />
            </div>
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 order-1 lg:order-2">
              <span className="text-sm font-semibold text-primary">Asistencia</span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Pasá lista en segundos</h3>
              <p className="mt-3 text-slate-500">
                Cada maestro ve solo su clase. Un toque por miembro y la asistencia queda
                guardada al instante con su historial.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                {["Filtrado automático por clase y departamento", "Historial completo por fecha", "Conteo de presentes en vivo"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {t}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Demo 2 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
              <span className="text-sm font-semibold text-primary">Estadísticas</span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Decisiones con datos reales</h3>
              <p className="mt-3 text-slate-500">
                Visualizá el crecimiento, la asistencia promedio y la actividad de cada
                departamento. Exportá a Excel cuando lo necesites.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                {["Gráficos por mes y departamento", "Comparativas de crecimiento", "Exportación a Excel"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {t}</li>
                ))}
              </ul>
            </div>
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
              <StatsMock />
            </div>
          </div>

          {/* Demo 3 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 order-2 lg:order-1">
              <CalendarMock />
            </div>
            <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 order-1 lg:order-2">
              <span className="text-sm font-semibold text-primary">Calendario y Eventos</span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Toda la agenda en un lugar</h3>
              <p className="mt-3 text-slate-500">
                Planificá eventos, gestioná solicitudes de actividades y mantené informada
                a toda la organización con notificaciones automáticas.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                {["Solicitudes de eventos con aprobación", "Recordatorios y cumpleaños", "Autorizaciones de campamento y salidas"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Significado del nombre */}
      <section className="max-w-3xl mx-auto px-5 py-8 text-center">
        <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-primary text-xs font-semibold px-3 py-1.5">
            <Sparkles className="h-3.5 w-3.5" /> El nombre lo dice todo
          </span>
          <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Nexus</span>{" "}
            significa <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">conexión</span>
          </h2>
          <p className="mt-4 text-slate-500">
            Porque de eso se trata: que toda la congregación esté conectada. Maestros,
            directores, secretaría y familias trabajando sobre la misma información, en
            tiempo real y desde un solo lugar.
          </p>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-6xl mx-auto px-5 py-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
            <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 grid place-items-center text-white mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Cada rol ve lo que le corresponde
            </h2>
            <p className="mt-4 text-slate-500">
              Permisos granulares por rol y departamento. El maestro toma asistencia de su
              clase, la secretaría gestiona todo, el director supervisa su área.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {roles.map((r) => (
                <span key={r.label} className={`rounded-full px-3 py-1.5 text-sm font-medium ${r.color}`}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
            <div className="rounded-2xl border border-slate-100 bg-white shadow-medium p-6 space-y-4">
              {[
                { r: "Maestro", a: "Su clase · Asistencia · Material", c: "bg-green-100 text-green-700" },
                { r: "Secretaría", a: "Todos los miembros · Eventos · Informes", c: "bg-blue-100 text-blue-700" },
                { r: "Director", a: "Su departamento · Estadísticas · Promoción", c: "bg-red-100 text-red-700" },
                { r: "Admin", a: "Acceso total · Usuarios · Configuración", c: "bg-violet-100 text-violet-700" },
              ].map((x) => (
                <div key={x.r} className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
                  <span className={`rounded-lg px-3 py-1 text-sm font-semibold ${x.c}`}>{x.r}</span>
                  <span className="text-sm text-slate-500">{x.a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mobile / PWA */}
      <section id="movil" className="bg-gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-5 py-12 grid lg:grid-cols-2 gap-12 items-center text-white">
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 text-white text-xs font-semibold px-3 py-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Progressive Web App
            </span>
            <h2 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight">
              Instalala en el celular, funciona como app nativa
            </h2>
            <p className="mt-4 text-white/80 max-w-lg">
              Sin pasar por la tienda de aplicaciones. Se instala en un toque, recibe
              notificaciones push y carga al instante desde cualquier dispositivo.
            </p>
            <ul className="mt-6 space-y-3">
              {["Instalación directa desde el navegador", "Notificaciones push en tiempo real", "Diseño responsive para móvil y escritorio"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="h-5 w-5 text-white" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700 flex justify-center">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto px-5 py-12 text-center">
        <div data-reveal className="opacity-0 translate-y-6 transition-all duration-700">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            ¿Te interesa Nexus para tu organización?
          </h2>
          <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
            Si Nexus te interesa para tu organización, escribinos por WhatsApp y conversamos
            cómo se adapta a lo que necesitás.
          </p>
          <div className="mt-9 flex justify-center">
            <DemoCTA className="text-lg !px-9 !py-4">Contactanos por WhatsApp</DemoCTA>
          </div>
          <p className="mt-4 text-sm text-slate-400">Respuesta el mismo día · Sin compromiso</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/fire.png" alt="Nexus" className="h-7 w-7 object-contain" />
            <span className="font-bold">Nexus</span>
            <span className="text-sm text-slate-400">· un producto de Novasoft Technologies</span>
          </div>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Novasoft Technologies. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
