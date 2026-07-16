import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TopbarContext, type TopbarContent } from './TopbarContext';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuthStore();
  const isKitchen = user?.role?.name === 'Kitchen';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [topbarContent, setTopbarContent] = useState<TopbarContent | null>(null);

  if (isKitchen) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 overflow-auto p-0">
          {children}
        </main>
      </div>
    );
  }

  return (
    <TopbarContext.Provider value={{ setTopbarContent }}>
      <div className="min-h-screen bg-background flex">
      {isSidebarOpen && (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        onNavigate={() => setIsSidebarOpen(false)}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar content={topbarContent} onMenuToggle={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      </div>
    </TopbarContext.Provider>
  );
}
