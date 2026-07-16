import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuthStore } from '@/stores/auth.store';
import { 
  Percent, 
  CreditCard, 
  Printer, 
  Receipt, 
  ToggleLeft, 
  Sliders, 
  Store, 
  Users, 
  Shield, 
  Key, 
  Armchair 
} from 'lucide-react';

import { TaxProfilesTab } from '../components/TaxProfilesTab';
import { PaymentMethodsTab } from '../components/PaymentMethodsTab';
import { PrintersTab } from '../components/PrintersTab';
import { ReceiptCustomizationTab } from '../components/ReceiptCustomizationTab';
import { FeatureFlagsTab } from '../components/FeatureFlagsTab';
import { GeneralTab } from '../components/GeneralTab';

// Tabs components
import { RestaurantTab } from '../components/RestaurantTab';
import { UsersTab } from '../components/UsersTab';
import { RolesTab } from '../components/RolesTab';
import { PermissionsTab } from '../components/PermissionsTab';
import { TablesConfigTab } from '../components/TablesConfigTab';

interface SettingsItem {
  value: string;
  label: string;
  icon: any;
  component: React.ReactNode;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const SECTIONS: SettingsSection[] = [
  {
    title: 'Restaurant Profile',
    items: [
      { value: 'restaurant', label: 'Restaurant Info', icon: Store, component: <RestaurantTab /> },
      { value: 'general', label: 'General & Numbers', icon: Sliders, component: <GeneralTab /> },
      { value: 'tables', label: 'Tables Config', icon: Armchair, component: <TablesConfigTab /> },
    ]
  },
  {
    title: 'Access Control (RBAC)',
    items: [
      { value: 'users', label: 'Users & Staff', icon: Users, component: <UsersTab /> },
      { value: 'roles', label: 'Roles Matrix', icon: Shield, component: <RolesTab /> },
      { value: 'permissions', label: 'Permissions', icon: Key, component: <PermissionsTab /> },
    ]
  },
  {
    title: 'Billing & Hardware',
    items: [
      { value: 'printers', label: 'Printers Configuration', icon: Printer, component: <PrintersTab /> },
      { value: 'taxes', label: 'Taxes & GST Profiles', icon: Percent, component: <TaxProfilesTab /> },
      { value: 'receipt', label: 'Receipt Templates', icon: Receipt, component: <ReceiptCustomizationTab /> },
      { value: 'payments', label: 'Payment Methods', icon: CreditCard, component: <PaymentMethodsTab /> },
      { value: 'features', label: 'Feature Flags', icon: ToggleLeft, component: <FeatureFlagsTab /> },
    ]
  }
];

export function SettingsPage() {
  const { user } = useAuthStore();
  const isManager = user?.role?.name === 'Manager';

  // Filter sections and items based on role permissions
  const visibleSections = SECTIONS.map((sec) => {
    const items = sec.items.filter((item) => {
      if (isManager) {
        // Manager only gets User staff management and Printers tab
        return item.value === 'users' || item.value === 'printers';
      }
      return true; // Owner has full access
    });
    return { ...sec, items };
  }).filter((sec) => sec.items.length > 0);

  // Set default active tab
  const defaultTab = visibleSections[0]?.items[0]?.value || 'restaurant';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Find active component
  const activeComponent = visibleSections
    .flatMap((s) => s.items)
    .find((i) => i.value === activeTab)?.component || <div className="text-muted-foreground text-sm">Select a settings tab.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Control Panel Settings"
        description="Configure your restaurant settings, staff permissions, taxes, printers and more"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Nav */}
        <div className="space-y-5 lg:col-span-1">
          <Accordion type="single" collapsible className="sm:hidden rounded-2xl border bg-card px-4">
            {visibleSections.map((section) => (
              <AccordionItem key={section.title} value={section.title}>
                <AccordionTrigger className="text-xs font-extrabold uppercase tracking-wider text-slate-600 no-underline hover:no-underline">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setActiveTab(item.value)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left text-xs font-bold transition-all ${
                          isActive ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="hidden space-y-5 sm:block">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 px-3">
                {section.title}
              </span>
              <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setActiveTab(item.value)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap lg:w-full lg:text-left ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          </div>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 bg-card border rounded-2xl p-4 sm:p-6 shadow-sm min-h-[500px] min-w-0">
          {activeComponent}
        </div>
      </div>
    </div>
  );
}
