import { create } from 'zustand';
import { supabase } from '../supabase';

interface AuthState {
  user: any | null;
  isLoading: boolean;
  setUser: (user: any | null) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, isLoading: false });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch (error) {
      console.error('Failed to initialize auth', error);
      set({ isLoading: false });
    }
  },
}));
