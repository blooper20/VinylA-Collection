import { supabase } from './supabase';

/**
 * Initiates the Google OAuth flow.
 * Note: Actual frontend implementation details (like redirecting) 
 * should be handled in the specific app environments (mobile/web).
 * This provides the core Supabase call.
 */
export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // You might want to specify redirectTo depending on the platform
        // redirectTo: 'your-app-scheme://callback',
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('signInWithGoogle exception:', error);
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
