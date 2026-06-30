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
  updateUnlockedBadges: (badgeIds: string[]) => Promise<void>;
  updateSelectedBadge: (badgeId: string | null) => Promise<void>;
  deleteAccount: () => Promise<void>;
  isRecoveryPending: boolean;
  recoverAccount: () => Promise<void>;
  resetAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isRecoveryPending: false,
  setUser: (user) => set({ user }),
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let activeUser = session?.user ?? null;
      let recovery = false;
      if (activeUser?.user_metadata?.del_yn === 'N') {
        recovery = true;
      }
      set({ user: activeUser, isLoading: false, isRecoveryPending: recovery });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        let newUser = session?.user ?? null;
        let isRec = false;
        if (newUser?.user_metadata?.del_yn === 'N') {
          isRec = true;
        }
        set({ user: newUser, isRecoveryPending: isRec });
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
  },
  updateUnlockedBadges: async (badgeIds: string[]) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { unlocked_badges: badgeIds }
      });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to update unlocked badges', error);
      throw error;
    }
  },
  updateSelectedBadge: async (badgeId: string | null) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { selected_badge: badgeId }
      });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user });
      }
    } catch (error) {
      console.error('Failed to update selected badge', error);
      throw error;
    }
  },
  deleteAccount: async () => {
    try {
      // 1. 회원 상태 변경 (Soft Delete: del_yn = 'N')
      const { error } = await supabase.auth.updateUser({
        data: { del_yn: 'N' }
      });
      if (error) throw error;
      
      // 2. 클라이언트 세션 종료
      await supabase.auth.signOut();
      set({ user: null });
      
      // 3. 메인으로 리다이렉트
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to delete account (soft delete)', error);
      throw error;
    }
  },
  recoverAccount: async () => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { del_yn: 'Y' }
      });
      if (error) throw error;
      if (data.user) {
        set({ user: data.user, isRecoveryPending: false });
      }
    } catch (error) {
      console.error('Failed to recover account', error);
      throw error;
    }
  },
  resetAccount: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("No user session");

      // 1. 기존 USER_VINYL 물리 삭제
      await supabase.from('USER_VINYL').delete().eq('USER_ID', session.user.id);

      // 2. user_metadata 초기화 (빈 껍데기로 만들기)
      const { data, error } = await supabase.auth.updateUser({
        data: {
          del_yn: 'Y',
          displayName: '',
          interests: [],
          unlocked_badges: [],
          selected_badge: null,
          featured_album: null
        }
      });
      if (error) throw error;
      
      if (data.user) {
        set({ user: data.user, isRecoveryPending: false });
      }
      
      // 메인으로 가서 온보딩을 태우기 위해 새로고침
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to reset account', error);
      throw error;
    }
  }
}));
