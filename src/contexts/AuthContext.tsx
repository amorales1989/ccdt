
import { createContext, useContext, useEffect, useState } from "react";
import { supabase, STORAGE_URL } from "@/integrations/supabase/client";
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
      console.log("Initial session check:", currentSession);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        getProfile(currentSession.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      console.log("Auth state changed:", _event, currentSession);
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
      console.log("Fetching profile for user:", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      console.log("Profile data:", data);
      
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
    try {
      console.log("Attempting sign up with data:", { email, ...userData });
      
      // Validate department_id format if provided
      if (userData.department_id) {
        // UUID validation regex
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userData.department_id)) {
          console.error("Invalid UUID format for department_id:", userData.department_id);
          throw new Error("Department ID tiene un formato inválido. Contacte al administrador.");
        }
      }
      
      // Step 1: Create the user in auth.users using Supabase Auth API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            role: userData.role,
            departments: userData.departments || [],
            assigned_class: userData.assigned_class || null
          }
        }
      });
      
      if (authError) {
        console.error("Auth error:", authError);
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error("No user returned from sign up");
      }
      
      console.log("User created successfully in auth.users:", authData.user.id);
      
      // Step 2: If user was created successfully and we have a department_id,
      // update the profile table directly with the department_id
      if (userData.department_id) {
        try {
          console.log(`Updating profile with department_id: ${userData.department_id} (${typeof userData.department_id})`);
          
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ department_id: userData.department_id })
            .eq('id', authData.user.id);
            
          if (profileError) {
            console.error("Error updating profile department_id:", profileError);
          } else {
            console.log("Profile successfully updated with department_id");
          }
        } catch (err) {
          console.error("Exception updating profile department_id:", err);
        }
      }
      
      // Removed the return of authData to match the Promise<void> return type
    } catch (error) {
      console.error("Error in signUp function:", error);
      throw error;
    }
  }

  async function signOut() {
    try {
      console.log("Starting sign out process");
      
      localStorage.removeItem('selectedDepartment');
      
      setUser(null);
      setProfile(null);
      setSession(null);
      
      try {
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
