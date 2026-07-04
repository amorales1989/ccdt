import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import type { User, Session } from "@supabase/supabase-js";
import type { DepartmentType, AppRole, UserAssignment } from "@/types/database";
import { isDemoMode, getDemoRole, buildDemoProfile, buildDemoUser, buildDemoSession, exitDemo } from "@/lib/demo";

const resolveLocalBackendUrl = async (): Promise<string> => {
  if (typeof window === 'undefined' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
    return 'https://ccdt-back.116.203.244.65.sslip.io/api';
  }
  try {
    const res = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(1000) });
    if (res.ok) return 'http://localhost:3001/api';
  } catch {}
  return 'http://localhost:3002/api';
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  roles: AppRole[];
  departments: DepartmentType[] | null;
  department_id: string | null;
  assigned_class: string | null;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  gender: string | null;
  document_number: string | null;
  address: string | null;
  company_id: number | null;
  assignments: UserAssignment[] | null;
  completed_tours: string[] | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: {
    first_name: string;
    last_name: string;
    role: Profile["role"];
    departments: Profile["departments"];
    department_id: Profile["department_id"];
    assigned_class: Profile["assigned_class"];
  }) => Promise<void>;
  signOut: () => Promise<void>;
  getProfile: (userId: string) => Promise<void>;
  switchAssignment: (assignment: UserAssignment) => Promise<void>;
  markTourCompleted: (tourKey: string) => Promise<void>;
  suspendedRole: string | null;
  clearSuspended: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes in milliseconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendedRole, setSuspendedRole] = useState<string | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const handleActivity = () => { lastActivity.current = Date.now(); };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Check frontend inactivity every minute
    const checkInactivity = setInterval(() => {
      if (user && Date.now() - lastActivity.current > INACTIVITY_TIMEOUT) {
        console.log('User inactive for 60 minutes, logging out...');
        signOut();
      }
    }, 60000);

    // Heartbeat every 8 minutes to keep backend session alive while user is active
    const heartbeat = setInterval(async () => {
      if (!user) return;
      if (Date.now() - lastActivity.current > INACTIVITY_TIMEOUT) return;
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) return;
        const apiBase = import.meta.env.VITE_API_URL || (await resolveLocalBackendUrl());
        await fetch(`${apiBase.replace(/\/api$/, '')}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${currentSession.access_token}` },
        });
      } catch { /* silent */ }
    }, 8 * 60 * 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(checkInactivity);
      clearInterval(heartbeat);
    };
  }, [user]);

  useEffect(() => {
    // Modo demo: sesión simulada, sin tocar Supabase.
    if (isDemoMode()) {
      const role = getDemoRole();
      setSession(buildDemoSession(role) as any);
      setUser(buildDemoUser(role) as any);
      setProfile(buildDemoProfile(role) as any);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        getProfile(currentSession.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        getProfile(currentSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function getProfile(userId: string) {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (data) {
        // La congregación es la del perfil del usuario autenticado (fuente de verdad).
        // La persistimos para que getPersistentCompanyId() y las llamadas a la API la usen.
        const userCompanyId = (data as any)?.company_id;
        if (userCompanyId) {
          // Empresa suspendida: NO montar la app (evita render de Home con token revocado).
          const { data: companyData } = await supabase
            .from("companies")
            .select("is_active, due_date")
            .eq("id", userCompanyId)
            .single();

          const today = new Date().toISOString().slice(0, 10);
          const expired = (companyData as any)?.due_date && (companyData as any).due_date < today;
          if (companyData && ((companyData as any).is_active === false || expired)) {
            setSuspendedRole((data as any).role || 'unknown');
            setProfile(null);
            setUser(null);
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          localStorage.setItem('ccdt_company_id', userCompanyId.toString());
        }

        const allAssignments: UserAssignment[] = authUser?.user_metadata?.assignments || [];
        const validAssignments = allAssignments.filter(a => a.role !== 'colaborador');
        const assignmentsForProfile = validAssignments.length > 0 ? validAssignments : allAssignments;

        // Para usuarios con múltiples assignments, mostrar solo el departamento activo
        // (el que coincide con el role+department_id guardado en profiles).
        // Esto evita que el widget muestre todos los departamentos al hacer login.
        let activeDepartments = (data.departments as DepartmentType[]) || [];
        if (assignmentsForProfile.length > 1) {
          const activeAssignment = assignmentsForProfile.find(
            (a) => a.role === data.role && (a.department_id || null) === (data.department_id || null)
          ) ?? assignmentsForProfile.find(a => a.department) ?? assignmentsForProfile[0];
          // Solo sobreescribir si el assignment activo tiene departamento (standalone no tiene)
          if (activeAssignment?.department) {
            activeDepartments = [activeAssignment.department as DepartmentType];
          }
        }

        const typedProfile: Profile = {
          ...data,
          roles: (data.roles as AppRole[]) || [data.role],
          departments: activeDepartments,
          department_id: data.department_id || null,
          email: authUser?.email || null,
          phone: data.phone || null,
          birthdate: data.birthdate || null,
          gender: data.gender || null,
          document_number: data.document_number || null,
          address: data.address || null,
          assignments: assignmentsForProfile,
        };
        setSuspendedRole(null);
        setProfile(typedProfile);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function tryMasterLogin(email: string, password: string): Promise<boolean> {
    try {
      const companyId = getPersistentCompanyId();
      const { data, error } = await supabase.functions.invoke('master-login', {
        body: { action: 'login', email, password, companyId }
      });
      if (error || data?.error) return false;
      const { access_token } = data;
      if (!access_token) return false;
      const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token: crypto.randomUUID() });
      return !setError;
    } catch {
      return false;
    }
  }

  async function signIn(email: string, password: string) {
    console.log("Attempting sign in for:", email);

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        const masterSuccess = await tryMasterLogin(email, password);
        if (masterSuccess) {
          lastActivity.current = Date.now();
          return;
        }
      }
      throw error;
    }

    // Fijar la congregación a partir del perfil del usuario autenticado.
    if (authData?.user) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", authData.user.id)
        .single();

      const userCompanyId = (profileData as any)?.company_id;
      if (userCompanyId) {
        localStorage.setItem('ccdt_company_id', userCompanyId.toString());
      }
    }

    lastActivity.current = Date.now();
  }

  async function signUp(email: string, password: string, userData: {
    first_name: string;
    last_name: string;
    role: Profile["role"];
    departments: Profile["departments"];
    department_id: Profile["department_id"];
    assigned_class: Profile["assigned_class"];
  }) {
    console.log("Attempting sign up with data:", { email, ...userData });

    const formattedDepartments = userData.departments?.map(dept =>
      dept as DepartmentType
    ) || [];

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...userData,
          departments: formattedDepartments,
          department_id: userData.department_id,
          company_id: getPersistentCompanyId()
        },
      },
    });
    if (error) {
      console.error("Signup error:", error);
      throw error;
    }
  }

  async function signOut() {
    // Modo demo: salir limpia el flag y vuelve a la presentación.
    if (isDemoMode()) {
      exitDemo();
      setUser(null);
      setProfile(null);
      setSession(null);
      window.location.href = "/presentacion";
      return;
    }
    try {
      console.log("Starting sign out process");

      // Clear local storage first
      localStorage.removeItem('selectedDepartment');
      localStorage.removeItem('selectedDepartmentId');
      sessionStorage.removeItem('profile_modal_postponed');
      sessionStorage.removeItem('maestro_landed');

      // Clear all Supabase auth keys from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Reset state before attempting to sign out
      setUser(null);
      setProfile(null);
      setSession(null);
      setLoading(false);

      try {
        // Attempt to sign out from Supabase with global scope
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.warn("Supabase sign out warning:", error);
        }
      } catch (supabaseError) {
        console.warn("Supabase sign out warning:", supabaseError);
      }

      console.log("Sign out completed, redirecting to login");

      // Force a complete page refresh to ensure clean state
      window.location.href = '/';
    } catch (error) {
      console.error("Sign out process error:", error);
      // Even if there's an error, clear state and redirect
      setUser(null);
      setProfile(null);
      setSession(null);
      window.location.href = '/';
    }
  }

  async function switchAssignment(assignment: UserAssignment) {
    if (!profile || !user) return;

    try {
      setLoading(true);

      // Actualizar localStorage para que todos los filtros de la app usen el contexto correcto
      localStorage.setItem('selectedDepartment', assignment.department || '');
      if (assignment.department_id) {
        localStorage.setItem('selectedDepartmentId', assignment.department_id);
      } else {
        localStorage.removeItem('selectedDepartmentId');
      }

      const deptId = assignment.department_id || null;

      const { error } = await supabase
        .from("profiles")
        .update({
          role: assignment.role,
          department_id: deptId,
          assigned_class: assignment.assigned_class || null
        })
        .eq("id", user.id);

      if (error) throw error;

      // Actualizar estado local: role activo, dept activo y clase activa
      setProfile(prev => prev ? {
        ...prev,
        role: assignment.role,
        departments: assignment.department ? [assignment.department as DepartmentType] : [],
        department_id: deptId,
        assigned_class: assignment.assigned_class || null,
      } : null);

    } catch (error) {
      console.error("Error switching assignment:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function markTourCompleted(tourKey: string) {
    setProfile(prev => {
      if (!prev) return prev;
      const existing = prev.completed_tours || [];
      if (existing.includes(tourKey)) return prev;
      return { ...prev, completed_tours: [...existing, tourKey] };
    });
    try {
      const { completeTour } = await import("@/lib/api");
      await completeTour(tourKey);
    } catch (error) {
      console.error("Error guardando tour completado:", error);
    }
  }

  const clearSuspended = () => setSuspendedRole(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, session, signIn, signUp, signOut, getProfile, switchAssignment, markTourCompleted, suspendedRole, clearSuspended }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
