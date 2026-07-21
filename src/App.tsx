import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/providers/AuthProvider';
import { BrandProvider } from '@/providers/BrandProvider';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SignupPage } from '@/features/auth/pages/SignupPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { OnboardingPage } from '@/features/onboarding/pages/OnboardingPage';
import { TablesPage } from '@/features/tables/pages/TablesPage';
import { OrderPage } from '@/features/orders/pages/OrderPage';
import { ROUTES } from '@/constants/routes';
import { Loader2 } from 'lucide-react';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage').then(module => ({ default: module.DashboardPage })));
const MenuPage = lazy(() => import('@/features/menu/pages/MenuPage').then(module => ({ default: module.MenuPage })));
const FloorsPage = lazy(() => import('@/features/floors/pages/FloorsPage').then(module => ({ default: module.FloorsPage })));
const KdsPage = lazy(() => import('@/features/kds/pages/KdsPage').then(module => ({ default: module.KdsPage })));
const CustomersPage = lazy(() => import('@/features/customers/pages/CustomersPage').then(module => ({ default: module.CustomersPage })));
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage').then(module => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

// Premium loading screen
function LoadingScreen() {
  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 select-none transform-gpu animate-fade-in">
      <div className="relative flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xl max-w-sm w-full mx-4">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0AB190]/5 to-transparent pointer-events-none rounded-3xl" />
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 relative overflow-hidden">
          <Loader2 className="w-8 h-8 animate-spin text-[#0AB190] duration-1000" />
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">NexVelt POS</h2>
        <p className="text-xs font-bold text-[#0AB190] tracking-widest uppercase mb-4">Enterprise POS System</p>
        <div className="text-[10px] font-semibold text-slate-400 animate-pulse">Initializing module...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <RealtimeProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Auth Routes */}
              <Route element={<AuthLayout />}>
                <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
                <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
              </Route>

              {/* Onboarding Wizard */}
              <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />

              {/* Protected Dashboard Routes */}
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                <Route path={ROUTES.TABLES} element={<TablesPage />} />
                <Route path={ROUTES.FLOORS} element={<FloorsPage />} />
                <Route path={ROUTES.MENU} element={<MenuPage />} />
                <Route path={ROUTES.ORDERS} element={<OrderPage />} />
                <Route path={ROUTES.KDS} element={<KdsPage />} />
                <Route path={ROUTES.CUSTOMERS} element={<CustomersPage />} />
                <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
                <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Routes>
          </Suspense>
        </RealtimeProvider>
      </BrandProvider>
    </AuthProvider>
  );
}
