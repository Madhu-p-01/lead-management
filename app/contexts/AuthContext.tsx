"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import supabase from "../utils/supabase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAuthorized: boolean;
  userRole: string | null;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthorized: false,
  userRole: null,
  signOut: async () => {},
  refreshAuth: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await checkUserAuthorization(currentUser);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await checkUserAuthorization(currentUser);
        } else {
          setIsAuthorized(false);
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const checkUserAuthorization = async (currentUser: User) => {
    try {
      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('is_authorized, role')
        .eq('id', currentUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking authorization:', profileError);
        setIsAuthorized(false);
        setUserRole(null);
        return;
      }

      if (profile) {
        setIsAuthorized(profile.is_authorized);
        setUserRole(profile.role);
      } else {
        // Profile doesn't exist yet, check authorized_users table
        const { data: authorizedUser } = await supabase
          .from('authorized_users')
          .select('role, is_active')
          .eq('email', currentUser.email)
          .single();

        setIsAuthorized(authorizedUser?.is_active || false);
        setUserRole(authorizedUser?.role || null);
      }
    } catch (error) {
      console.error('Error in checkUserAuthorization:', error);
      setIsAuthorized(false);
      setUserRole(null);
    }
  };

  const refreshAuth = async () => {
    if (user) {
      await checkUserAuthorization(user);
    }
  };

  const signOut = async () => {
    try {
      // Clear state first
      setUser(null);
      setIsAuthorized(false);
      setUserRole(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error signing out:", error);
      }
      
      // Force redirect using window.location for a clean slate
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
      // Force redirect even if there's an error
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthorized, userRole, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
