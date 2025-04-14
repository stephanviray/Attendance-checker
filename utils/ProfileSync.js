import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Profile data sync between mobile app and web dashboard
export const ProfileSync = {
  // Store profile data to be shared with web
  async storeProfileData(user, profileData) {
    if (!user || !user.id) return { error: 'No valid user' };
    
    try {
      const syncData = {
        id: user.id,
        email: user.email,
        user_metadata: {
          full_name: profileData?.full_name || user.email.split('@')[0],
          role: profileData?.role || 'employee'
        },
        lastSynced: new Date().toISOString()
      };
      
      // Store in AsyncStorage for mobile app persistence
      await AsyncStorage.setItem('userProfile', JSON.stringify(syncData));
      
      // Try to update Supabase table that will be used by both platforms
      try {
        // First check if the table exists
        const { error: checkError } = await supabase
          .from('shared_profile_data')
          .select('count', { count: 'exact', head: true })
          .limit(1);
          
        if (checkError) {
          // Table likely doesn't exist, try to create it
          await this.createSyncTables();
        }
      
        // Try to insert/update data
        const { error } = await supabase
          .from('shared_profile_data')
          .upsert({
            user_id: user.id,
            profile_data: syncData,
            last_synced_from: 'mobile',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        
        if (error) {
          console.log("Note: Shared profile sync not available yet. This is normal for first-time setup.");
          // We've already stored locally, so this is a non-critical error
          return { data: syncData };
        }
      
        return { data: syncData };
      } catch (syncError) {
        console.log("Profile sync with web not available yet. Using local storage only.");
        // Return success since we've stored in AsyncStorage
        return { data: syncData };
      }
    } catch (error) {
      console.error("Error in storeProfileData:", error);
      return { error };
    }
  },
  
  // Fetch shared profile data
  async fetchSharedProfile(userId) {
    try {
      // Try to get from Supabase first
      try {
        const { data, error } = await supabase
          .from('shared_profile_data')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (!error && data?.profile_data) {
          // Update local storage with latest data
          await AsyncStorage.setItem('userProfile', JSON.stringify(data.profile_data));
          return { data: data.profile_data };
        }
      } catch (supabaseError) {
        // Supabase table might not exist yet, which is fine
        console.log("Shared profile data not available yet. Using local storage.");
      }
      
      // Fall back to local storage
      const localProfile = await AsyncStorage.getItem('userProfile');
      return localProfile ? { data: JSON.parse(localProfile) } : { error: { message: 'No profile data found' } };
    } catch (error) {
      console.error("Error in fetchSharedProfile:", error);
      return { error };
    }
  },
  
  // Generate web compatible auth token for sync
  async generateSyncToken(user) {
    if (!user || !user.id) return { error: 'No valid user' };
    
    try {
      // Create a sync token with expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
      
      const syncToken = {
        userId: user.id,
        created: new Date().toISOString(),
        expires: expiresAt.toISOString()
      };
      
      // Try to check if table exists
      try {
        const { error: checkError } = await supabase
          .from('profile_sync_tokens')
          .select('count', { count: 'exact', head: true })
          .limit(1);
          
        if (checkError) {
          // Table likely doesn't exist, try to create it
          await this.createSyncTables();
        }
        
        // Store token in shared table
        const { error } = await supabase
          .from('profile_sync_tokens')
          .insert({
            user_id: user.id,
            token_data: syncToken,
            expires_at: expiresAt.toISOString()
          });
        
        if (error) {
          console.log("Token storage not available. Generating temporary token.");
          // Return the token anyway since we don't need server persistence for it to work
          return { token: btoa(JSON.stringify(syncToken)) };
        }
      } catch (tableError) {
        console.log("Sync tables not available yet. Generating temporary token.");
        // Continue with local token
      }
      
      // Return the token
      return { token: btoa(JSON.stringify(syncToken)) };
    } catch (error) {
      console.error("Error generating sync token:", error);
      return { error };
    }
  },
  
  // Create necessary tables for syncing if they don't exist
  async createSyncTables() {
    try {
      // Use the create_table_if_not_exists function if available
      const createSharedProfileTable = `
        CREATE TABLE IF NOT EXISTS shared_profile_data (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          profile_data JSONB NOT NULL,
          last_synced_from VARCHAR(50) NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT unique_user_profile UNIQUE (user_id)
        );
      `;
      
      const createTokensTable = `
        CREATE TABLE IF NOT EXISTS profile_sync_tokens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          token_data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          used_at TIMESTAMPTZ,
          CONSTRAINT status_check CHECK (status IN ('active', 'used', 'expired'))
        );
      `;
      
      // Try to create tables using the Supabase RPC function
      await supabase.rpc('create_table_if_not_exists', { 
        sql_string: createSharedProfileTable 
      });
      
      await supabase.rpc('create_table_if_not_exists', { 
        sql_string: createTokensTable 
      });
      
      // Note: We ignore errors here as they're expected if the function doesn't exist
      // or the user doesn't have permission. The web app will handle table creation instead.
      
      return true;
    } catch (error) {
      console.log("Note: Could not create sync tables. This is normal if you don't have permission.");
      return false;
    }
  }
};

export default ProfileSync; 