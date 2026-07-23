import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { RestaurantLogo } from '@/components/shared/RestaurantLogo';
import { Button } from '@/components/ui/button';
import { Menu, Bell, Loader2 } from 'lucide-react';
import type { TopbarContent } from './TopbarContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ROUTES } from '@/constants/routes';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface TopbarProps {
  onMenuToggle?: () => void;
  content?: TopbarContent | null;
}

export function Topbar({ onMenuToggle, content }: TopbarProps) {
  const { user, setUser, logout } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';

  // Profile Dialog State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user, isProfileOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const getShiftName = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'Morning Shift';
    if (hour >= 14 && hour < 22) return 'Evening Shift';
    return 'Night Shift';
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      logout();
      navigate(ROUTES.LOGIN);
      toast({ title: 'Logged out successfully' });
    } catch (err: any) {
      toast({
        title: 'Logout failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    if (!user) return;

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          phone: phone || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      setUser({
        ...user,
        full_name: fullName,
        phone: phone || null,
        avatar_url: avatarUrl || null,
      });

      toast({ title: 'Profile updated successfully' });
      setIsProfileOpen(false);
    } catch (err: any) {
      toast({
        title: 'Failed to update profile',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const defaultLeft = (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <RestaurantLogo size="md" showName nameClassName="sm:text-base text-foreground font-extrabold" />
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary sm:inline">
            {getShiftName()}
          </span>
        </div>
        <span className="hidden text-xs font-medium text-muted-foreground lg:block">{user?.full_name} ({user?.role?.name})</span>
      </div>
    </div>
  );

  const isCashier = user?.role?.name === 'Cashier';

  return (
    <>
      <header className="flex h-14 sm:h-16 flex-nowrap items-center gap-x-3 border-b border-border bg-card px-3 sm:px-4 md:px-6 shrink-0 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Mobile menu trigger */}
          {onMenuToggle && (
            <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={onMenuToggle} aria-label="Open navigation menu">
              <Menu className="w-5 h-5" />
            </Button>
          )}
          {content?.left ?? defaultLeft}
        </div>

        {content?.center && (
          <div className="order-3 w-full sm:order-2 sm:w-auto sm:max-w-xl sm:flex-1">
            {content.center}
          </div>
        )}

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <span className="hidden whitespace-nowrap text-xs font-semibold text-primary md:inline">{currentTime}</span>
          <span className="hidden max-w-28 truncate text-xs font-medium text-muted-foreground xl:inline">{user?.full_name}</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarImage src={user?.avatar_url || ''} alt={user?.full_name} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">ID: {user?.id.substring(0, 8)}...</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => {
                e.preventDefault();
                setIsProfileOpen(true);
              }}>
                Profile
              </DropdownMenuItem>
              {!isCashier && (
                <DropdownMenuItem onSelect={() => navigate(ROUTES.SETTINGS)}>
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Bell className="w-5 h-5" />
          </Button>
          {content?.right}
        </div>
      </header>

      {/* Edit Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSaveProfile}>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your personal info here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fullName" className="text-right">
                  Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g. +919876543210"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="avatarUrl" className="text-right">
                  Avatar URL
                </Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="col-span-3"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProfileOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProfile} className="bg-primary hover:bg-primary/95 text-white font-bold">
                {isSavingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

