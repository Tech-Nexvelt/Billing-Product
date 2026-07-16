import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useRestaurantStore } from '@/stores/restaurant.store';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


export function RestaurantTab() {
  const { user } = useAuthStore();
  const { setRestaurant } = useRestaurantStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [businessType, setBusinessType] = useState('restaurant');

  useEffect(() => {
    if (!user?.restaurant_id) return;
    loadRestaurantData();
  }, [user?.restaurant_id]);

  const loadRestaurantData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user!.restaurant_id)
        .single();

      if (error) throw error;

      if (data) {
        setName(data.name);
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setAddress(data.address || '');
        setGstNumber(data.gst_number || '');
        setCurrency(data.currency);
        setTimezone(data.timezone);
        setBusinessType(data.business_type || 'restaurant');
      }
    } catch (err) {
      console.error('Error loading restaurant:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          gst_number: gstNumber || null,
          currency,
          timezone,
          business_type: businessType,
        })
        .eq('id', user!.restaurant_id);

      if (error) throw error;

      // Re-fetch the updated record and sync to the global store
      // so the sidebar and other components reflect the new name instantly
      const { data: updated } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', user!.restaurant_id)
        .single();
      if (updated) setRestaurant(updated);

      toast({ title: 'Restaurant profile updated successfully' });
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOwner = user?.role?.name === 'Owner';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div>
        <h3 className="text-base font-bold">Restaurant Profile</h3>
        <p className="text-xs text-muted-foreground">Manage organization name, address and billing defaults</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="restaurantName">Restaurant Name</Label>
          <Input
            id="restaurantName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurantPhone">Phone Number</Label>
          <Input
            id="restaurantPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!isOwner}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurantEmail">Email Address</Label>
          <Input
            id="restaurantEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isOwner}
          />
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="restaurantAddress">Street Address</Label>
          <Input
            id="restaurantAddress"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!isOwner}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurantGst">GSTIN (Tax Reg Number)</Label>
          <Input
            id="restaurantGst"
            placeholder="e.g. 29ABCDE1234F1Z5"
            value={gstNumber}
            onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
            disabled={!isOwner}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="businessType">Business Type</Label>
          <select
            id="businessType"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            disabled={!isOwner}
          >
            <option value="restaurant">Restaurant</option>
            <option value="cafe">Café</option>
            <option value="bakery">Bakery</option>
            <option value="bar">Bar & Lounge</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency Code</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={!isOwner}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={!isOwner}
          />
        </div>
      </div>

      {isOwner && (
        <div className="pt-2">
          <Button type="submit" className="bg-primary hover:bg-primary/95 text-white font-bold h-10" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Profile Changes
          </Button>
        </div>
      )}
    </form>
  );
}
