import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/constants/routes';
import { Loader2 } from 'lucide-react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, setSession, setUser, setLoading } = useAuthStore();
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

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 select-none transform-gpu">
        <div className="relative flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl max-w-sm w-full mx-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 relative overflow-hidden">
            <Loader2 className="w-8 h-8 animate-spin text-[#0AB190] duration-1000" />
          </div>
          <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">NexVelt POS</h2>
          <p className="text-xs font-bold text-[#0AB190] tracking-widest uppercase mb-4">Enterprise POS System</p>
          <div className="text-[10px] font-semibold text-slate-400 animate-pulse">Restoring session...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
