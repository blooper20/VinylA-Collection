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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let activeUser = session?.user ?? null;
      if (activeUser?.user_metadata?.del_yn === 'N') {
        // 기존에 탈퇴했던 계정으로 다시 로그인한 경우 -> 완전 초기화 후 신규 가입 처리
        const { wipeUserData } = await import('../supabaseDb');
        await wipeUserData(activeUser.id);
        
        // 프로필 초기화 및 활성화
        const { data, error } = await supabase.auth.updateUser({
          data: {
            del_yn: 'Y',
            displayName: null,
            interests: null,
            avatar_url: null,
            featured_album: null,
            unlocked_badges: null,
            selected_badge: null
          }
        });
        
        if (!error && data.user) {
          activeUser = data.user;
        }
      }
      set({ user: activeUser, isLoading: false });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        let newUser = session?.user ?? null;
        if (newUser?.user_metadata?.del_yn === 'N') {
          // On-the-fly login with deleted account
          const { wipeUserData } = await import('../supabaseDb');
          await wipeUserData(newUser.id);
          const { data } = await supabase.auth.updateUser({
            data: {
              del_yn: 'Y',
              displayName: null,
              interests: null,
              avatar_url: null,
              featured_album: null,
              unlocked_badges: null,
              selected_badge: null
            }
          });
          if (data.user) newUser = data.user;
        }
        set({ user: newUser });
      });
    } catch (error) {
      console.error('Failed to initialize auth', error);
      set({ isLoading: false });
    }
  },
  updateProfile: async (displayName: string, interests: string[], avatarUrl?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("User not authenticated");
      const user = session.user;

      if (displayName !== user.user_metadata?.displayName) {
        const { data: profile } = await supabase
          .from('PROFILES')
          .select('*')
          .eq('USER_ID', user.id)
          .single();

        if (profile && profile.LAST_NAME_CHANGED_AT) {
          const lastChanged = new Date(profile.LAST_NAME_CHANGED_AT);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - lastChanged.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 30) {
            throw new Error(`닉네임은 30일에 한 번만 변경 가능합니다. (남은 기간: ${30 - diffDays}일)`);
          }
        }

        const { error: profileError } = await supabase
          .from('PROFILES')
          .upsert({
            USER_ID: user.id,
            DISPLAY_NAME: displayName,
            LAST_NAME_CHANGED_AT: new Date().toISOString()
          });

        if (profileError) {
          if (profileError.code === '23505') {
            throw new Error('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.');
          }
          throw profileError;
        }
      }

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
  updateProfileWithAvatarFile: async (displayName: string, interests: string[], file?: File | null, removeAvatar?: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("User not authenticated");
      const user = session.user;

      if (displayName !== user.user_metadata?.displayName) {
        const { data: profile } = await supabase
          .from('PROFILES')
          .select('*')
          .eq('USER_ID', user.id)
          .single();

        if (profile && profile.LAST_NAME_CHANGED_AT) {
          const lastChanged = new Date(profile.LAST_NAME_CHANGED_AT);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - lastChanged.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < 30) {
            throw new Error(`닉네임은 30일에 한 번만 변경 가능합니다. (남은 기간: ${30 - diffDays}일)`);
          }
        }

        const { error: profileError } = await supabase
          .from('PROFILES')
          .upsert({
            USER_ID: user.id,
            DISPLAY_NAME: displayName,
            LAST_NAME_CHANGED_AT: new Date().toISOString()
          });

        if (profileError) {
          if (profileError.code === '23505') {
            throw new Error('이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.');
          }
          throw profileError;
        }
      }

      let avatarUrl = undefined;
      
      if (removeAvatar) {
        avatarUrl = '/logo.png';
      } else if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
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
      // 백단에서는 Soft Delete 처리 (UI상으로는 완전 삭제로 안내됨)
      const { error } = await supabase.auth.updateUser({
        data: { del_yn: 'N' }
      });
      if (error) throw error;
      
      // 2. 클라이언트 세션 종료
      await supabase.auth.signOut();
      set({ user: null });
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('VINYL_A_LOCAL_COLLECTION');
        localStorage.removeItem('vinyls_dbData');
      }

      // 3. 메인으로 리다이렉트
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Failed to delete account', error);
      throw error;
    }
  }
}));
