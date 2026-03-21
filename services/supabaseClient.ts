import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client — bypasses RLS and can call auth.admin APIs
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
