import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/constants/routes';
import { Loader2 } from 'lucide-react';

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex flex-col bg-primary text-primary-foreground p-12 justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">NexVelt POS</h1>
          <p className="mt-4 text-lg opacity-90">Enterprise Restaurant Management</p>
        </div>
        <div className="space-y-6">
          <blockquote className="text-xl font-medium border-l-4 pl-4 border-primary-foreground/30">
            "Streamline your operations, delight your customers, and grow your business with our comprehensive suite of tools."
          </blockquote>
        </div>
      </div>
      
      {/* Right panel - Auth Forms */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
