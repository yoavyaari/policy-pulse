import { create } from "zustand";
import { supabase } from "../utils/supabaseConfig";
import type { Session, User, AuthError } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: AuthError | null) => void;
  listenToAuthState: () => { data: { subscription: any } }; // Adjust 'any' based on actual Subscription type if known
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ data: { user: User | null, session: Session | null }; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (
    email: string
  ) => Promise<{ data: {}; error: AuthError | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  loading: true, // Start loading initially until first auth state check completes
  error: null,
  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Listen to Supabase auth state changes
  listenToAuthState: () => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = get().user;
        const newUser = session?.user ?? null;
        const currentUserId = currentUser?.id;
        const newUserId = newUser?.id;

        // Only update state if user ID changes or user logs in/out
        if (currentUserId !== newUserId) {
          console.log(`Auth state changed: User changed from ${currentUserId} to ${newUserId}`);
          set({
            session: session,
            user: newUser,
            loading: false,
            error: null,
          });
        } else {
           // If user ID is the same, maybe only update session if it changed?
           // For now, let's prioritize stopping the project fetch loop.
           // We can refine session updates later if needed.
           // console.log(`Auth state changed: User ID ${newUserId} unchanged, event: ${_event}`);
        }
      }
    );
    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
       console.log("Initial session fetched:", session);
       set({ session: session, user: session?.user ?? null, loading: false });
    }).catch((error) => {
       console.error("Error fetching initial session:", error);
       set({ error: error as AuthError, loading: false });
    });

    return authListener;
  },

  // Sign in with email and password
  signInWithPassword: async (email, password) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({
      session: data.session,
      user: data.user,
      loading: false,
      error: error,
    });
    if (error) {
      console.error("Sign in error:", error);
    }
    return { error };
  },

  // Sign up with email and password
  signUp: async (email, password) => {
    set({ loading: true, error: null });
    // Note: Supabase might require email confirmation by default.
    // Handle this flow in your UI if needed.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Options can be added here if needed, e.g., user metadata
      // options: {
      //   data: {
      //     first_name: 'John',
      //     age: 30,
      //   }
      // }
    });
    set({
      // Session might be null initially if email confirmation is required
      session: data.session,
      user: data.user,
      loading: false,
      error: error,
    });
     if (error) {
      console.error("Sign up error:", error);
    }
    // Return data and error for UI handling
    return { data: { user: data.user, session: data.session } , error };
  },

  // Sign out
  signOut: async () => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      loading: false,
      error: error,
    });
     if (error) {
      console.error("Sign out error:", error);
    }
    return { error };
  },

  // Reset password
  resetPasswordForEmail: async (email) => {
    set({ loading: true, error: null });
    // Supabase sends a password reset link to the user's email.
    // Ensure you have email templates configured in your Supabase project.
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        // Optional: specify redirect URL after password reset
        // redirectTo: 'https://your-app.com/update-password',
    });
    set({ loading: false, error: error });
     if (error) {
      console.error("Password reset error:", error);
    }
    // Return data (usually empty on success) and error
    return { data, error };
  },
}));

// Initialize the listener when the store is loaded/used for the first time.
// This could also be called explicitly from your App's entry point (e.g., AppProvider.tsx).
// useAuthStore.getState().listenToAuthState(); // Consider where to best initiate this
