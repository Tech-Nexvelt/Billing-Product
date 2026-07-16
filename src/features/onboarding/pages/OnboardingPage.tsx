import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/stores/auth.store';
import { restaurantOnboardingSchema, RestaurantOnboardingInput } from '@/schemas/restaurant.schema';
import { restaurantService } from '@/services/restaurant.service';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Store, DollarSign, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function OnboardingPage() {
  const { session, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<RestaurantOnboardingInput>({
    resolver: zodResolver(restaurantOnboardingSchema),
    defaultValues: {
      organizationName: '',
      restaurantName: '',
      phone: '',
      email: '',
      address: '',
      gstNumber: '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      businessType: 'restaurant',
      numFloors: 1,
      numTables: 10,
    },
  });

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) {
      fieldsToValidate = ['organizationName', 'restaurantName', 'phone', 'email'];
    } else if (step === 2) {
      fieldsToValidate = ['numFloors', 'numTables'];
    } else if (step === 3) {
      fieldsToValidate = ['address', 'gstNumber'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const onSubmit = async (data: RestaurantOnboardingInput) => {
    if (!session?.user) return;
    setIsSubmitting(true);
    try {
      const res = await restaurantService.onboardRestaurant(session.user.id, data);
      if (res.error) throw new Error(res.error.message);

      // Force refresh the session to update client JWT claims with restaurant_id
      await supabase.auth.refreshSession();

      // Re-fetch user profile to sync updated restaurant metadata
      const { data: updatedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setUser(updatedUser);
      toast({ title: 'Success!', description: 'Restaurant workspace created successfully.' });
      navigate(ROUTES.DASHBOARD);
    } catch (err: any) {
      toast({
        title: 'Onboarding failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                placeholder="e.g. NexVelt Foods Ltd."
                {...register('organizationName')}
              />
              {errors.organizationName && (
                <p className="text-xs text-destructive">{errors.organizationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="restaurantName">Restaurant Name</Label>
              <Input
                id="restaurantName"
                placeholder="e.g. The Grand Kitchen"
                {...register('restaurantName')}
              />
              {errors.restaurantName && (
                <p className="text-xs text-destructive">{errors.restaurantName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input id="phone" placeholder="+911234567890" {...register('phone')} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input id="email" type="email" placeholder="contact@grandkitchen.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numFloors">Number of Floors</Label>
                <Input
                  id="numFloors"
                  type="number"
                  min={1}
                  max={5}
                  {...register('numFloors', { valueAsNumber: true })}
                />
                {errors.numFloors && (
                  <p className="text-xs text-destructive">{errors.numFloors.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="numTables">Number of Tables</Label>
                <Input
                  id="numTables"
                  type="number"
                  min={1}
                  max={50}
                  {...register('numTables', { valueAsNumber: true })}
                />
                {errors.numTables && (
                  <p className="text-xs text-destructive">{errors.numTables.message}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              We'll automatically create default floor and table layout for you. You can rearrange them later.
            </p>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" placeholder="123 Main Street, Bangalore" {...register('address')} />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstNumber">GST Number (Optional)</Label>
              <Input id="gstNumber" placeholder="29ABCDE1234F1Z5" {...register('gstNumber')} />
              {errors.gstNumber && (
                <p className="text-xs text-destructive">{errors.gstNumber.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  {...register('currency')}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  {...register('timezone')}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 4:
        const values = watch();
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Workspace Summary</h3>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Organization</span>
                <span className="font-medium">{values.organizationName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Restaurant</span>
                <span className="font-medium">{values.restaurantName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Total Layout</span>
                <span className="font-medium">
                  {values.numFloors} Floors • {values.numTables} Tables
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Currency & Timezone</span>
                <span className="font-medium">
                  {values.currency} • {values.timezone}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-3 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Ready to generate your multi-tenant workspace with default RBAC roles!</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const steps = [
    { label: 'Restaurant', icon: Store },
    { label: 'Layout', icon: Settings },
    { label: 'Location', icon: DollarSign },
    { label: 'Confirm', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Set up your workspace</h1>
          <p className="mt-2 text-muted-foreground">Complete onboarding to start using NexVelt POS</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between w-full relative px-6">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 z-0" />
          {steps.map((s, idx) => {
            const num = idx + 1;
            const Icon = s.icon;
            const isCompleted = step > num;
            const isActive = step === num;

            return (
              <div key={s.label} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                      ? 'bg-background border-primary text-primary scale-110 shadow-sm'
                      : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-xs font-semibold mt-2 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Content Card */}
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle>Step {step} of 4</CardTitle>
            <CardDescription>
              {step === 1 && 'Basic restaurant brand details'}
              {step === 2 && 'Floor and table layouts'}
              {step === 3 && 'Billing currency and location details'}
              {step === 4 && 'Verify details before proceeding'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              {renderStep()}

              <div className="flex justify-between mt-8 border-t pt-4">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep} disabled={isSubmitting}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 4 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Workspace...
                      </>
                    ) : (
                      'Finish & Launch'
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Add supabase import just in case
import { supabase } from '@/lib/supabase';
