import { create } from 'zustand';
import { supabase } from '../supabase';

interface AuthState {
  user: any | null;
  isLoading: boolean;
  setUser: (user: any | null) => void;
  initializeAuth: () => Promise<void>;
  updateProfile: (displayName: string, interests: string[], avatarUrl?: string) => Promise<void>;
  updateProfileWithAvatarFile: (displayName: string, interests: string[], file?: File) => Promise<void>;
  updateFeaturedAlbum: (albumId: number | null) => Promise<void>;
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
  updateProfile: async (displayName: string, interests: string[], avatarUrl?: string) => {
    try {
      const updateData: any = { displayName, interests };
      if (avatarUrl !== undefined) {
        updateData.avatar_url = avatarUrl;
      }
      const { data, error } = await supabase.auth.updateUser({
        data: updateData
      });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to update profile', error);
      throw error;
    }
  },
  updateProfileWithAvatarFile: async (displayName: string, interests: string[], file?: File) => {
    try {
      let avatarUrl = undefined;
      
      if (file) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error("User not authenticated");
        
        const fileExt = file.name.split('.').pop();
        const filePath = `${session.user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        avatarUrl = publicUrlData.publicUrl;
      }
      
      const updateData: any = { displayName, interests };
      if (avatarUrl) {
        updateData.avatar_url = avatarUrl;
      }
      
      const { data, error } = await supabase.auth.updateUser({
        data: updateData
      });
      
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to update profile with avatar file', error);
      throw error;
    }
  },
  updateFeaturedAlbum: async (albumId: number | null) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { featured_album_id: albumId }
      });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to update featured album', error);
      throw error;
    }
  }
}));
