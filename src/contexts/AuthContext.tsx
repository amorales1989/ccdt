
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { DepartmentType, AppRole } from "@/types/database";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  departments: DepartmentType[] | null;
  department_id: string | null;
  assigned_class: string | null;
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
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        getProfile(currentSession.user.id);
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      
      // Ensure departments is correctly typed as DepartmentType[]
      if (data) {
        const typedProfile: Profile = {
          ...data,
          departments: data.departments as DepartmentType[] || [],
          department_id: data.department_id || null
        };
        setProfile(typedProfile);
      }
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
          department_id: userData.department_id
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
      
      // Clear local storage first
      localStorage.removeItem('selectedDepartment');
      
      // Reset state before attempting to sign out
      setUser(null);
      setProfile(null);
      setSession(null);
      
      try {
        // Attempt to sign out from Supabase
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn("Supabase sign out warning:", error);
        }
      } catch (supabaseError) {
        console.warn("Supabase sign out warning:", supabaseError);
      }
      
      console.log("Sign out completed");
    } catch (error) {
      console.error("Sign out process error:", error);
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, session, signIn, signUp, signOut, getProfile }}>
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
