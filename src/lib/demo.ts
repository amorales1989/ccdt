// Modo Demo: sesión simulada + datos mock + sin escrituras reales.
// Se activa con enterDemo(role); AuthContext, apiCall y el cliente supabase
// detectan isDemoMode() y devuelven datos de ejemplo.
import type { AppRole } from "@/types/database";

const DEMO_KEY = "nexus_demo_mode";
const ROLE_KEY = "nexus_demo_role";

export type DemoRole = "admin" | "secretaria" | "director" | "maestro";

export const DEMO_PDF_HEADER = [
  { text: "Organización Comunitaria de Ejemplo", enabled: true },
  { text: "Personería Jurídica N° 00.000 (Datos ficticios - Demo)", enabled: true },
  { text: "Av. Demo 1234, Ciudad Ejemplo, Pcia. Bs. As.", enabled: true },
  { text: "C.U.I.T. N° 30-00000000-0", enabled: true },
];

export const DEMO_ROLES: { value: DemoRole; label: string; desc: string }[] = [
  { value: "admin", label: "Administrador", desc: "Acceso total: usuarios, configuración y todos los departamentos." },
  { value: "secretaria", label: "Secretaría", desc: "Gestiona miembros, eventos e informes de toda la organización." },
  { value: "director", label: "Director", desc: "Supervisa su departamento: estadísticas y promoción de miembros." },
  { value: "maestro", label: "Maestro", desc: "Toma asistencia y ve los miembros de su clase asignada." },
];

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === "true";
  } catch {
    return false;
  }
}

export function getDemoRole(): DemoRole {
  return (localStorage.getItem(ROLE_KEY) as DemoRole) || "admin";
}

export function enterDemo(role: DemoRole) {
  localStorage.setItem(DEMO_KEY, "true");
  localStorage.setItem(ROLE_KEY, role);
}

export function exitDemo() {
  localStorage.removeItem(DEMO_KEY);
  localStorage.removeItem(ROLE_KEY);
}

/* ----------------------------- Dataset ----------------------------- */

const COMPANY_ID = 1;

const DEPARTMENTS = [
  { id: "dep-escuelita", name: "escuelita", description: "Niños de 3 a 8 años", classes: ["Sala 3", "Sala 4", "Sala 5"], created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", company_id: COMPANY_ID },
  { id: "dep-adolescentes", name: "adolescentes", description: "De 9 a 13 años", classes: ["Clase A", "Clase B"], created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", company_id: COMPANY_ID },
  { id: "dep-jovenes", name: "jovenes", description: "De 14 a 25 años", classes: ["Pre-juveniles", "Juveniles"], created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", company_id: COMPANY_ID },
  { id: "dep-adultos", name: "adultos", description: "Mayores de 25", classes: ["Matrimonios", "Damas", "Caballeros"], created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z", company_id: COMPANY_ID },
];

const MALE = ["Mateo", "Lucas", "Benjamín", "Thiago", "Joaquín", "Santiago", "Bautista", "Lautaro", "Nicolás", "Tomás", "Gael", "Dylan"];
const FEMALE = ["Sofía", "Valentina", "Martina", "Catalina", "Emma", "Mía", "Olivia", "Renata", "Julieta", "Camila", "Isabella", "Delfina"];
const SURNAMES = ["Gómez", "Rodríguez", "Fernández", "López", "Martínez", "Pérez", "García", "Sánchez", "Romero", "Torres", "Ruiz", "Álvarez"];

function makeStudents() {
  const out: any[] = [];
  let i = 0;
  for (const dep of DEPARTMENTS) {
    for (const cls of dep.classes) {
      const count = 3 + (i % 3); // 3–5 por clase
      for (let n = 0; n < count; n++) {
        const female = (i + n) % 2 === 0;
        const first = (female ? FEMALE : MALE)[(i * 3 + n) % 12];
        const last = SURNAMES[(i * 5 + n) % 12];
        // algunos cumpleaños en junio (hoy ~ 2026-06-01) para el widget
        const month = n === 0 ? "06" : String(((i + n) % 12) + 1).padStart(2, "0");
        const day = String(((i * 7 + n) % 27) + 1).padStart(2, "0");
        const year = 2000 + ((i + n) % 18);
        const id = `stu-${i}-${n}`;
        out.push({
          id,
          first_name: first,
          last_name: last,
          gender: female ? "femenino" : "masculino",
          birthdate: `${year}-${month}-${day}`,
          department: dep.name,
          department_id: dep.id,
          assigned_class: cls,
          document_number: `4${(i * 1000 + n * 37 + 100000).toString().slice(0, 7)}`,
          phone: "11 5555-0000",
          address: "Av. Siempreviva 742",
          photo_url: null,
          nuevo: n === count - 1,
          created_at: "2025-02-01T00:00:00Z",
          updated_at: "2025-02-01T00:00:00Z",
          departments: { id: dep.id, name: dep.name },
          dept_assignments: [{ department_id: dep.id, assigned_class: cls, role_in_dept: "alumno" }],
        });
      }
      i++;
    }
  }
  return out;
}

const STUDENTS = makeStudents();

const COMPANY = {
  id: COMPANY_ID,
  name: "Nexus Demo",
  congregation_name: "Congregación Central",
  logo_url: null,
  show_name: true,
  dark_mode: false,
  auto_save: true,
  notifications: true,
  show_attendance_history: true,
  compact_view: false,
  show_profile_images: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const PROFILES = [
  { id: "usr-admin", first_name: "Ana", last_name: "Director", role: "admin", roles: ["admin"], departments: [], department_id: null, assigned_class: null, email: "admin@demo.app", phone: "11 5555-1000", gender: "femenino", company_id: COMPANY_ID, document_number: "30111222" },
  { id: "usr-secre", first_name: "Lucía", last_name: "Méndez", role: "secretaria", roles: ["secretaria"], departments: [], department_id: null, assigned_class: null, email: "secretaria@demo.app", phone: "11 5555-1001", gender: "femenino", company_id: COMPANY_ID, document_number: "31222333" },
  { id: "usr-dir", first_name: "Carlos", last_name: "Ibáñez", role: "director", roles: ["director"], departments: ["jovenes"], department_id: "dep-jovenes", assigned_class: null, email: "director@demo.app", phone: "11 5555-1002", gender: "masculino", company_id: COMPANY_ID, document_number: "28333444" },
  { id: "usr-maes", first_name: "Pedro", last_name: "Suárez", role: "maestro", roles: ["maestro"], departments: ["adolescentes"], department_id: "dep-adolescentes", assigned_class: "Clase A", email: "maestro@demo.app", phone: "11 5555-1003", gender: "masculino", company_id: COMPANY_ID, document_number: "33444555" },
  { id: "usr-maes2", first_name: "Marta", last_name: "Ríos", role: "maestro", roles: ["maestro"], departments: ["escuelita"], department_id: "dep-escuelita", assigned_class: "Sala 4", email: "maestro2@demo.app", phone: "11 5555-1004", gender: "femenino", company_id: COMPANY_ID, document_number: "34555666" },
  { id: "usr-lider", first_name: "Diego", last_name: "Castro", role: "lider", roles: ["lider"], departments: ["jovenes"], department_id: "dep-jovenes", assigned_class: "Juveniles", email: "lider@demo.app", phone: "11 5555-1005", gender: "masculino", company_id: COMPANY_ID, document_number: "32666777" },
];

const EVENTS = [
  { id: "ev-1", title: "Reunión general de líderes", date: "2026-06-03", time: "20:00", description: "Planificación del trimestre.", departamento: "jovenes", solicitud: false, estado: "aprobada", created_at: "2025-05-01T00:00:00Z", updated_at: "2025-05-01T00:00:00Z" },
  { id: "ev-2", title: "Campamento de jóvenes", date: "2026-06-13", end_date: "2026-06-15", time: "08:00", description: "Campamento anual.", departamento: "jovenes", solicitud: false, estado: "aprobada", created_at: "2025-05-01T00:00:00Z", updated_at: "2025-05-01T00:00:00Z" },
  { id: "ev-3", title: "Clase especial de música", date: "2026-06-07", time: "10:00", description: "Taller para adolescentes.", departamento: "adolescentes", solicitud: true, estado: "solicitud", solicitante: "Pedro Suárez", created_at: "2025-05-20T00:00:00Z", updated_at: "2025-05-20T00:00:00Z" },
  { id: "ev-4", title: "Salida recreativa", date: "2026-06-21", time: "09:00", description: "Día de campo.", departamento: "escuelita", solicitud: true, estado: "solicitud", solicitante: "Marta Ríos", created_at: "2025-05-22T00:00:00Z", updated_at: "2025-05-22T00:00:00Z" },
];

function makeAttendance() {
  const dates = ["2026-05-03", "2026-05-10", "2026-05-17", "2026-05-24", "2026-05-31"];
  const rows: any[] = [];
  let k = 0;
  for (const date of dates) {
    for (const s of STUDENTS) {
      const present = (k * 7 + date.length) % 10 < 8; // ~80% asistencia
      const dep = DEPARTMENTS.find((d) => d.id === s.department_id);
      rows.push({
        id: `att-${date}-${s.id}`,
        student_id: s.id,
        date,
        status: present,
        department_id: s.department_id,
        assigned_class: s.assigned_class,
        company_id: COMPANY_ID,
        created_at: `${date}T12:00:00Z`,
        updated_at: `${date}T12:00:00Z`,
        attendance_department: { name: dep?.name },
        students: {
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          gender: s.gender,
          deleted_at: null,
          departments: { name: dep?.name },
        },
      });
      k++;
    }
  }
  return rows;
}

const ATTENDANCE = makeAttendance();

const MAINTENANCE = [
  { id: "mnt-1", title: "Luz quemada en el aula 2", description: "Reemplazar tubo fluorescente.", status: "pendiente", priority: "media", company_id: COMPANY_ID, created_at: "2026-05-28T10:00:00Z" },
  { id: "mnt-2", title: "Filtración en el baño", description: "Revisar cañería.", status: "en_proceso", priority: "alta", company_id: COMPANY_ID, created_at: "2026-05-25T10:00:00Z" },
];

const TABLES: Record<string, any[]> = {
  departments: DEPARTMENTS,
  students: STUDENTS,
  events: EVENTS,
  attendance: ATTENDANCE,
  profiles: PROFILES,
  companies: [COMPANY],
  maintenance_requests: MAINTENANCE,
  notifications: [],
  student_authorizations: [],
  notification_recipients: [],
};

/* ----------------------------- Auth simulada ----------------------------- */

export function buildDemoProfile(role: DemoRole) {
  const base = PROFILES.find((p) => p.role === role) || PROFILES[0];
  return {
    ...base,
    completed_tours: [],
    assignments:
      role === "maestro"
        ? [{ id: "asg-1", role, department: "adolescentes", department_id: "dep-adolescentes", assigned_class: "Clase A" }]
        : role === "director"
        ? [{ id: "asg-1", role, department: "jovenes", department_id: "dep-jovenes" }]
        : [],
  };
}

export function buildDemoUser(role: DemoRole) {
  const p = buildDemoProfile(role);
  return {
    id: p.id,
    email: p.email,
    user_metadata: { assignments: p.assignments, first_name: p.first_name, last_name: p.last_name },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2025-01-01T00:00:00Z",
  };
}

export function buildDemoSession(role: DemoRole) {
  return {
    access_token: "demo-token",
    refresh_token: "demo-refresh",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: buildDemoUser(role),
  };
}

/* ----------------------------- Interceptor apiCall ----------------------------- */

function param(endpoint: string, key: string): string | null {
  const q = endpoint.split("?")[1];
  if (!q) return null;
  return new URLSearchParams(q).get(key);
}

// Resuelve las llamadas al backend Node en modo demo.
export function resolveDemoApiCall(endpoint: string, options: RequestInit = {}): any {
  const method = (options.method || "GET").toUpperCase();
  const path = endpoint.split("?")[0];

  // Escrituras: no persisten, devuelven éxito.
  if (method !== "GET") {
    notifyDemoWrite();
    return { success: true, data: parseBody(options) };
  }

  if (path === "/students") {
    let list = STUDENTS;
    const depId = param(endpoint, "department_id");
    const cls = param(endpoint, "assigned_class");
    if (depId) list = list.filter((s) => s.department_id === depId);
    if (cls) list = list.filter((s) => (s.assigned_class || "").toLowerCase() === cls.toLowerCase());
    return { data: list };
  }
  if (path === "/students/stats") {
    const male = STUDENTS.filter((s) => s.gender === "masculino").length;
    const female = STUDENTS.length - male;
    return { data: { male, female, total: STUDENTS.length } };
  }
  if (path === "/students/birthdays/upcoming") return { data: [] };
  if (path.startsWith("/students/search") || path.startsWith("/students/lookup")) return { data: [] };
  if (path.startsWith("/students/")) {
    const id = path.split("/")[2];
    return { data: STUDENTS.find((s) => s.id === id) || null };
  }
  if (path === "/staff-reports") return { data: [] };
  if (path === "/staff-reports/unread-count") return { data: { count: 0 }, count: 0 };
  if (path.startsWith("/staff-reports/eligible")) return { data: PROFILES };
  if (path === "/material") return { data: [] };
  if (path === "/tours") return { data: [] };
  if (path.startsWith("/observations/")) return { data: [] };
  if (path.startsWith("/profiles/search")) return { data: [] };
  if (path.startsWith("/whatsapp")) return { data: { status: "disconnected" } };

  return { data: [] };
}

function parseBody(options: RequestInit): any {
  try {
    if (typeof options.body === "string") return JSON.parse(options.body);
  } catch {
    /* noop */
  }
  return {};
}

function notifyDemoWrite() {
  try {
    window.dispatchEvent(new CustomEvent("nexus-demo-write"));
  } catch {
    /* noop */
  }
}

/* ----------------------------- Cliente supabase simulado ----------------------------- */

function makeBuilder(table: string) {
  const data = TABLES[table] || [];
  const filters: { op: string; col: string; val: any }[] = [];
  const state = { single: false, write: false, payload: null as any };

  const builder: any = {};
  const ignored = [
    "select", "like", "not", "contains", "containedBy", "or", "and", "filter",
    "match", "order", "limit", "range", "overlaps", "textSearch", "csv", "geojson", "explain",
  ];
  ignored.forEach((m) => (builder[m] = () => builder));

  builder.eq = (col: string, val: any) => { filters.push({ op: "eq", col, val }); return builder; };
  builder.neq = (col: string, val: any) => { filters.push({ op: "neq", col, val }); return builder; };
  builder.gt = (col: string, val: any) => { filters.push({ op: "gt", col, val }); return builder; };
  builder.gte = (col: string, val: any) => { filters.push({ op: "gte", col, val }); return builder; };
  builder.lt = (col: string, val: any) => { filters.push({ op: "lt", col, val }); return builder; };
  builder.lte = (col: string, val: any) => { filters.push({ op: "lte", col, val }); return builder; };
  builder.in = (col: string, val: any[]) => { filters.push({ op: "in", col, val }); return builder; };
  builder.ilike = (col: string, val: string) => { filters.push({ op: "ilike", col, val }); return builder; };
  builder.is = (col: string, val: any) => { filters.push({ op: "is", col, val }); return builder; };

  builder.insert = (p: any) => { state.write = true; state.payload = Array.isArray(p) ? p[0] : p; notifyDemoWrite(); return builder; };
  builder.update = (p: any) => { state.write = true; state.payload = p; notifyDemoWrite(); return builder; };
  builder.upsert = (p: any) => { state.write = true; state.payload = Array.isArray(p) ? p[0] : p; notifyDemoWrite(); return builder; };
  builder.delete = () => { state.write = true; notifyDemoWrite(); return builder; };
  builder.single = () => { state.single = true; return builder; };
  builder.maybeSingle = () => { state.single = true; return builder; };

  const applyFilters = (rows: any[]) =>
    rows.filter((r) =>
      filters.every((f) => {
        const v = r[f.col];
        if (f.op === "eq") return String(v) === String(f.val);
        if (f.op === "neq") return String(v) !== String(f.val);
        if (f.op === "gt") return v > f.val;
        if (f.op === "gte") return v >= f.val;
        if (f.op === "lt") return v < f.val;
        if (f.op === "lte") return v <= f.val;
        if (f.op === "in") return (f.val || []).map(String).includes(String(v));
        if (f.op === "ilike") return String(v ?? "").toLowerCase() === String(f.val).replace(/%/g, "").toLowerCase();
        if (f.op === "is") return f.val === null ? v == null : v === f.val;
        return true;
      })
    );

  const resolve = () => {
    if (state.write) {
      const row = { id: `demo-${Date.now()}`, ...(state.payload || {}) };
      return { data: state.single ? row : [row], error: null, count: 1, status: 200, statusText: "OK" };
    }
    const arr = applyFilters(data);
    return { data: state.single ? arr[0] ?? null : arr, error: null, count: arr.length, status: 200, statusText: "OK" };
  };

  builder.then = (onFulfilled: any, onRejected?: any) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  builder.catch = () => builder;

  return builder;
}

let cachedClient: any = null;

export function createDemoClient() {
  if (cachedClient) return cachedClient;
  const role = getDemoRole();
  cachedClient = {
    from: (table: string) => makeBuilder(table),
    rpc: () => Promise.resolve({ data: [], error: null }),
    functions: {
      invoke: (_name: string, _opts?: any) => {
        notifyDemoWrite();
        return Promise.resolve({ data: { success: true, users: PROFILES }, error: null });
      },
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: "demo.png" }, error: null }),
        remove: () => Promise.resolve({ data: [], error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "/fire.png" } }),
      }),
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: buildDemoSession(role) }, error: null }),
      getUser: () => Promise.resolve({ data: { user: buildDemoUser(role) }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => { exitDemo(); return Promise.resolve({ error: null }); },
      setSession: () => Promise.resolve({ data: {}, error: null }),
      signInWithPassword: () => Promise.resolve({ data: {}, error: null }),
    },
  };
  return cachedClient;
}
