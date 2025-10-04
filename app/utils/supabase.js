// app/utils/supabase.js
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with proper session handling
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      // Enable automatic session refresh
      autoRefreshToken: true,
      // Persist session in local storage
      persistSession: true,
      // Detect session from URL on page load
      detectSessionInUrl: true,
      // Storage key for session
      storageKey: 'supabase.auth.token',
      // Use local storage for session persistence
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

// Helper function to ensure session is loaded before making requests
export const ensureSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error getting session:', error);
      return null;
    }
    return session;
  } catch (error) {
    console.error('Error ensuring session:', error);
    return null;
  }
};

// Helper function to get a fresh client with current session
export const getSupabaseClient = () => {
  return supabase;
};

export default supabase;
