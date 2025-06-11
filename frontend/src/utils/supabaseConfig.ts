import { createClient } from "@supabase/supabase-js";

// Read the Supabase configuration from environment variables injected by Vite
// These variables need to be prefixed with `VITE_` to be available on the
// client. See `frontend/README.md` for details.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
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
