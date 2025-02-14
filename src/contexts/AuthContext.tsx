
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: Database["public"]["Enums"]["app_role"];
  departments: Database["public"]["Enums"]["department_type"][] | null;
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
  }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const checkInactivity = setInterval(() => {
      if (user && Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        console.log('User inactive for 10 minutes, logging out...');
        signOut();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(checkInactivity);
    };
  }, [user, lastActivity]);

  useEffect(() => {
    // Configurar la persistencia de la sesión
    supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      console.log("Auth state changed:", _event, currentSession);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        await getProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Intentar recuperar la sesión inicial
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", initialSession);
        
        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          await getProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  async function getProfile(userId: string) {
    try {
      console.log("Fetching profile for user:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      console.log("Profile data:", data);
      setProfile(data);
    } catch (error) {
      console.error("Error loading user profile:", error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    console.log("Attempting sign in for:", email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setLastActivity(Date.now());
  }

  async function signUp(email: string, password: string, userData: { 
    first_name: string; 
    last_name: string; 
    role: Profile["role"];
    departments: Profile["departments"];
  }) {
    console.log("Attempting sign up with data:", { email, ...userData });
    
    const formattedDepartments = userData.departments?.map(dept => 
      dept as Database["public"]["Enums"]["department_type"]
    ) || [];

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...userData,
          departments: formattedDepartments
        },
      },
    });
    if (error) {
      console.error("Signup error:", error);
      throw error;
    }
  }

  async function signOut() {
    try {
      console.log("Starting sign out process");
      
      // Limpiar el localStorage primero
      localStorage.clear(); // Limpiamos todo el localStorage para asegurar
      
      // Resetear el estado antes de intentar cerrar sesión
      setUser(null);
      setProfile(null);
      setSession(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Supabase sign out warning:", error);
      }
      
      console.log("Sign out completed");
    } catch (error) {
      console.error("Sign out process error:", error);
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, session, signIn, signUp, signOut }}>
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
