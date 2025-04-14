import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  
  useEffect(() => {
    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch user role when authenticated
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('role, custom_id')
              .eq('id', session.user.id)
              .single();
            
            if (!error && data) {
              setUserRole(data.role);
              
              // Update user object with custom_id
              setUser(prev => ({
                ...prev,
                custom_id: data.custom_id
              }));
            } else {
              console.log('Profile not found or error:', error);
              // Create profile if it doesn't exist
              if (error && error.code === 'PGRST116') {
                console.log('Profile not found, trying to create one');
                try {
                  await supabase.rpc('create_profile_for_user', { 
                    user_id: session.user.id,
                    user_email: session.user.email,
                    user_role: 'employee',
                    user_full_name: session.user.email.split('@')[0]
                  });
                  
                  // Retry fetching after creation
                  const { data: newData, error: newError } = await supabase
                    .from('profiles')
                    .select('role, custom_id')
                    .eq('id', session.user.id)
                    .single();
                    
                  if (!newError && newData) {
                    setUserRole(newData.role);
                    
                    setUser(prev => ({
                      ...prev,
                      custom_id: newData.custom_id
                    }));
                  }
                } catch (createError) {
                  console.error('Error creating profile:', createError);
                }
              }
            }
          } catch (e) {
            console.error('Error in session update:', e);
          }
        } else {
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // Initialize session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Fetch user role
        supabase
          .from('profiles')
          .select('role, custom_id')
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setUserRole(data.role);
              
              // Update user object with custom_id
              setUser(prev => ({
                ...prev,
                custom_id: data.custom_id
              }));
            } else if (error && error.code === 'PGRST116') {
              // Profile doesn't exist, try to create it
              console.log('Profile not found on init, trying to create one');
              supabase.rpc('create_profile_for_user', { 
                user_id: session.user.id,
                user_email: session.user.email,
                user_role: 'employee',
                user_full_name: session.user.email.split('@')[0]
              }).then(() => {
                // Retry fetching after creation
                supabase
                  .from('profiles')
                  .select('role, custom_id')
                  .eq('id', session.user.id)
                  .single()
                  .then(({ data: newData, error: newError }) => {
                    if (!newError && newData) {
                      setUserRole(newData.role);
                      
                      setUser(prev => ({
                        ...prev,
                        custom_id: newData.custom_id
                      }));
                    }
                    setLoading(false);
                  });
              }).catch(e => {
                console.error('Error creating profile on init:', e);
                setLoading(false);
              });
              return; // Skip the setLoading(false) below since we'll set it later
            }
            setLoading(false);
          })
          .catch(e => {
            console.error('Error fetching profile on init:', e);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => {
      // Clean up subscriptions
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email, password, role = 'employee') => {
    try {
      // First check if email already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email);
        
      if (existingUsers && existingUsers.length > 0) {
        return { data: null, error: { message: 'Email already exists' } };
      }
      
      // Create auth user
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            role
          }
        }
      });
      
      if (error) {
        console.error('Auth signup error:', error);
        
        // Handle rate limit error specifically
        if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
          return { 
            data: null, 
            error: { 
              message: 'Too many signup attempts. Please wait about 30 seconds before trying again.' 
            } 
          };
        }
        
        return { data, error };
      }
      
      if (!data?.user?.id) {
        console.error('No user ID returned from signup');
        return { data, error: { message: 'Failed to create user account' } };
      }
      
      // Create a profile record with role - but don't wait for RLS policies
      // to avoid infinite recursion
      try {
        // For company accounts, set company_id to their own user ID
        const company_id = role === 'company' ? data.user.id : null;
        
        await supabase.rpc('create_profile_for_user', { 
          user_id: data.user.id,
          user_email: email,
          user_role: role,
          user_full_name: email.split('@')[0],
          company_id: company_id
        });
        
        // If this is a company account, update the profile to set company_id
        if (role === 'company') {
          await supabase
            .from('profiles')
            .update({ company_id: data.user.id })
            .eq('id', data.user.id);
        }
      } catch (profileError) {
        console.error('Error creating profile via RPC:', profileError);
        
        // Create the profile directly - less secure but avoids RLS issues
        try {
          // Generate employee ID if this is an employee account
          let custom_id = null;
          if (role === 'employee') {
            // First get the max existing employee ID
            const { data: maxIdData } = await supabase
              .from('profiles')
              .select('custom_id')
              .like('custom_id', 'EMP%')
              .order('custom_id', { ascending: false })
              .limit(1);
              
            let nextNum = 1;
            if (maxIdData && maxIdData.length > 0 && maxIdData[0].custom_id) {
              const currentId = maxIdData[0].custom_id;
              // Extract the number portion and increment it
              const numPart = currentId.substring(3); // Remove 'EMP' prefix
              nextNum = parseInt(numPart, 10) + 1;
            }
            
            // Format with leading zeros
            custom_id = `EMP${nextNum.toString().padStart(3, '0')}`;
          }
        
          const { error: directProfileError } = await supabase
            .from('profiles')
            .insert([{ 
              id: data.user.id, 
              email, 
              role, 
              created_at: new Date(),
              full_name: email.split('@')[0],
              company_id: role === 'company' ? data.user.id : null,
              custom_id: custom_id
            }]);
            
          if (directProfileError) {
            console.error('Direct profile insert error:', directProfileError);
            return { 
              data, 
              warning: 'Account created but profile setup failed. Please contact support.' 
            };
          }
        } catch (e) {
          console.error('Final fallback profile creation failed:', e);
          return { 
            data, 
            warning: 'Account created but profile setup failed. Please contact support.' 
          };
        }
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Signin error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Signin error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id);
        
      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { data: null, error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userRole,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 