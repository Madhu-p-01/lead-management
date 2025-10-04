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
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const router = useRouter();

  // Log whenever loading state changes
  useEffect(() => {
    console.log("Loading state changed to:", loading);
  }, [loading]);

  // Log whenever isAuthorized changes
  useEffect(() => {
    console.log("isAuthorized state changed to:", isAuthorized);
  }, [isAuthorized]);

  useEffect(() => {
    let mounted = true;

    // Check active session - use getSession first (faster)
    const checkSession = async () => {
      try {
        // Wait for session to be fully loaded from storage
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
        }

        if (session && mounted) {
          setUser(session.user);
          // Check authorization before setting loading to false
          await checkUserAuthorization(session.user);
        } else if (mounted) {
          setUser(null);
          setIsAuthorized(false);
          setUserRole(null);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        if (mounted) {
          // Mark initial check as done and set loading to false
          setInitialCheckDone(true);
          setLoading(false);
        }
      }
    };

    checkSession();

    // Auto-refresh session every 5 minutes
    const refreshInterval = setInterval(async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.refreshSession();
        if (!error && session && mounted) {
          setUser(session.user);
        }
      } catch (error) {
        console.error("Auto-refresh error:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);

      if (!mounted) return;

      // Skip events that we handle elsewhere
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        // Just update the user for these events, don't re-check authorization
        if (session?.user && mounted) {
          setUser(session.user);
        }
        return;
      }

      // For SIGNED_OUT and other events
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await checkUserAuthorization(currentUser);
      } else {
        setIsAuthorized(false);
        setUserRole(null);
      }

      // Only set loading to false if initial check is done
      if (initialCheckDone) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearInterval(refreshInterval);
      subscription.unsubscribe();
    };
  }, [initialCheckDone]);

  const checkUserAuthorization = async (currentUser: User) => {
    console.log("Checking user authorization for:", currentUser.email);
    try {
      // Single optimized query - check user_profiles first
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("is_authorized, role")
        .eq("id", currentUser.id)
        .maybeSingle(); // Use maybeSingle to avoid error if not found

      if (profile) {
        console.log("Authorization check result:", { isAuthorized: profile.is_authorized, role: profile.role });
        setIsAuthorized(profile.is_authorized);
        setUserRole(profile.role);
      } else if (!profileError || profileError.code === "PGRST116") {
        // Profile doesn't exist yet, check authorized_users table
        const { data: authorizedUser } = await supabase
          .from("authorized_users")
          .select("role, is_active")
          .eq("email", currentUser.email)
          .maybeSingle();

        console.log("Fallback authorization check:", { isActive: authorizedUser?.is_active, role: authorizedUser?.role });
        setIsAuthorized(authorizedUser?.is_active || false);
        setUserRole(authorizedUser?.role || null);
      } else {
        console.error("Error checking authorization:", profileError);
        setIsAuthorized(false);
        setUserRole(null);
      }
    } catch (error) {
      console.error("Error in checkUserAuthorization:", error);
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
    <AuthContext.Provider
      value={{ user, loading, isAuthorized, userRole, signOut, refreshAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}
