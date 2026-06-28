import { supabase } from './supabase';

/**
 * Initiates the Google OAuth flow.
 */
export const signInWithGoogle = async (redirectTo?: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('signInWithGoogle exception:', error);
    throw error;
  }
};

/**
 * Initiates the Apple OAuth flow.
 */
export const signInWithApple = async (redirectTo?: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo,
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('signInWithApple exception:', error);
    throw error;
  }
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

