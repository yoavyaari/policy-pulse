import { createClient } from "@supabase/supabase-js";

// Read credentials from Vite environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing. Make sure to set them up.",
  );
  // Optionally throw an error or handle this case as needed
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  // Optional configuration options
  auth: {
    // Enable persistence (e.g., localStorage) by default
    // You can disable it or use other storage options if needed
    // persistSession: true,
    // autoRefreshToken: true,
    // detectSessionInUrl: true,
  },
});
