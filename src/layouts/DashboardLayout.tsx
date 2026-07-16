import { useEffect } from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/constants/routes';
import { AppShell } from '@/components/shared/AppShell';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated && user) {
      const isKitchen = user.role?.name === 'Kitchen';
      const isCashier = user.role?.name === 'Cashier';
      const isManager = user.role?.name === 'Manager';
      const isOwner = user.role?.name === 'Owner';

      // 1. Kitchen redirect
      if (isKitchen) {
        if (location.pathname !== ROUTES.KDS) {
          navigate(ROUTES.KDS, { replace: true });
        }
        return;
      }
      
      // Non-kitchen attempting to access KDS
      if (location.pathname === ROUTES.KDS) {
        if (isCashier || isManager) {
          navigate(ROUTES.TABLES, { replace: true });
        } else {
          navigate(ROUTES.DASHBOARD, { replace: true });
        }
        return;
      }

      // 2. Cashier role restriction
      if (isCashier) {
        const prohibited = [ROUTES.DASHBOARD, ROUTES.MENU, ROUTES.REPORTS, ROUTES.SETTINGS];
        if (prohibited.includes(location.pathname as any) || location.pathname === '/') {
          navigate(ROUTES.TABLES, { replace: true });
        }
        return;
      }

      // 3. Manager role restriction
      if (isManager) {
        const prohibited = [ROUTES.DASHBOARD, ROUTES.MENU];
        if (prohibited.includes(location.pathname as any) || location.pathname === '/') {
          navigate(ROUTES.TABLES, { replace: true });
        }
        return;
      }

      // 4. Owner landing redirect
      if (isOwner && location.pathname === '/') {
        navigate(ROUTES.DASHBOARD, { replace: true });
      }
    }
  }, [isAuthenticated, user, location.pathname, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
