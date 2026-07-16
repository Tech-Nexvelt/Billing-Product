import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/constants/routes';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setUser, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          setSession(session);
          
          if (session?.user) {
            // Fetch custom user profile
            const { data: profile } = await supabase
              .from('users')
              .select('*, role:roles(*)')
              .eq('id', session.user.id)
              .maybeSingle();
              
            if (profile) {
              setUser(profile);
              if (!profile.restaurant_id && location.pathname !== ROUTES.ONBOARDING) {
                navigate(ROUTES.ONBOARDING);
              }
            } else {
              setUser(null);
              if (location.pathname !== ROUTES.ONBOARDING) {
                navigate(ROUTES.ONBOARDING);
              }
            }
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        
        setSession(session);
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('users')
            .select('*, role:roles(*)')
            .eq('id', session.user.id)
            .maybeSingle();
            
          if (profile) {
            setUser(profile);
            if (!profile.restaurant_id && location.pathname !== ROUTES.ONBOARDING) {
              navigate(ROUTES.ONBOARDING);
            }
          } else {
            setUser(null);
            if (location.pathname !== ROUTES.ONBOARDING) {
              navigate(ROUTES.ONBOARDING);
            }
          }
        } else {
          setUser(null);
          // Redirect to login if not already on auth page
          if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/signup') && !location.pathname.startsWith('/forgot-password')) {
            navigate(ROUTES.LOGIN);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname, setSession, setUser, setLoading]);

  return <>{children}</>;
}
