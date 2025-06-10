import { createClient } from "@supabase/supabase-js";

// Use the environment variables provided during the setup
const supabaseUrl = "https://ytwedbxohfvlbcisoluq.supabase.co";
// Use the public anon key
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0d2VkYnhvaGZ2bGJjaXNvbHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MzI2OTQsImV4cCI6MjA2MTQwODY5NH0.EnY50YOW1SKafnEvKe03gXlGj7scorZA5heSsSJBAH0";

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
