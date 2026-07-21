import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { RestaurantLogo } from '@/components/shared/RestaurantLogo';
import { ROUTES } from '@/constants/routes';
import { 
  Armchair, 
  LogOut,
  LayoutDashboard,
  Settings,
  BarChart3,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: ROUTES.DASHBOARD, end: true },
  { icon: Armchair, label: 'Tables', path: ROUTES.TABLES },
  { icon: UtensilsCrossed, label: 'Menu', path: ROUTES.MENU },
  { icon: BarChart3, label: 'Reports', path: ROUTES.REPORTS },
  { icon: Settings, label: 'Settings', path: ROUTES.SETTINGS },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function Sidebar({
  isMobileOpen = false,
  isCollapsed = false,
  onToggleCollapse,
  onNavigate,
}: SidebarProps) {
  const { logout, user } = useAuthStore();
  const { restaurant } = useRestaurantStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate(ROUTES.LOGIN);
  };

  const isOwner = user?.role?.name === 'Owner';
  const isManager = user?.role?.name === 'Manager';
  const isCashier = user?.role?.name === 'Cashier';

  const filteredNavItems = navItems.filter(item => {
    if (isOwner) return true;
    if (isManager) return item.path === ROUTES.TABLES || item.path === ROUTES.REPORTS || item.path === ROUTES.SETTINGS;
    if (isCashier) return item.path === ROUTES.TABLES;
    return false;
  });

  return (
    <aside
      className={cn(
        // Base: hidden on mobile, flex on desktop; smooth width transition
        'border-r border-border bg-card flex-col hidden md:flex transition-all duration-300 ease-in-out relative shrink-0',
        isCollapsed ? 'w-[68px]' : 'w-64',
        // Mobile override: show as fixed overlay
        isMobileOpen && 'fixed inset-y-0 left-0 z-50 flex w-72 shadow-2xl md:static md:shadow-none'
      )}
    >
      {/* Brand header */}
      <div className={cn(
        'h-16 flex items-center border-b border-border shrink-0 relative',
        isCollapsed ? 'justify-center px-0' : 'px-4 gap-2'
      )}>
        <RestaurantLogo size="sm" />
        {/* Business name — hidden when collapsed */}
        <span
          className={cn(
            'text-[15px] font-bold tracking-tight truncate transition-all duration-300',
            isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100 max-w-[130px]'
          )}
          title={restaurant?.name}
        >
          {restaurant?.name || 'NexVelt POS'}
        </span>

        {/* Toggle arrow — only visible on desktop, not when sidebar is in mobile overlay mode */}
        {!isMobileOpen && (
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'absolute -right-3 top-1/2 -translate-y-1/2 z-10',
              'w-6 h-6 rounded-full bg-card border border-border shadow-sm',
              'flex items-center justify-center',
              'text-muted-foreground hover:text-primary hover:border-primary',
              'transition-colors duration-150'
            )}
          >
            {isCollapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        'flex-1 overflow-y-auto overflow-x-hidden py-3',
        isCollapsed ? 'px-2 space-y-1' : 'px-3 space-y-1'
      )}>
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-md text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center w-full h-10' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className={cn(
              'transition-all duration-300 whitespace-nowrap',
              isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'
            )}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer — Log out */}
      <div className={cn('border-t border-border shrink-0', isCollapsed ? 'p-2' : 'p-3')}>
        <Button
          variant="ghost"
          title={isCollapsed ? 'Log out' : undefined}
          className={cn(
            'w-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors',
            isCollapsed ? 'justify-center px-0' : 'justify-start'
          )}
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span className={cn(
            'ml-3 transition-all duration-300 whitespace-nowrap',
            isCollapsed ? 'w-0 opacity-0 overflow-hidden ml-0' : 'opacity-100'
          )}>
            Log out
          </span>
        </Button>
      </div>
    </aside>
  );
}
