import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, SignupInput } from '@/schemas/auth.schema';
import { supabase } from '@/lib/supabase';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, User, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SignupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    try {
      // 1. SignUp in Supabase Auth
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            restaurant_name: data.restaurantName,
          },
        },
      });

      if (signupError) throw signupError;

      if (authData.user) {
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account or complete onboarding.',
        });
        navigate(ROUTES.LOGIN);
      }
    } catch (err: any) {
      toast({
        title: 'Registration failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border border-border shadow-md mb-4 p-2 overflow-hidden">
          <img 
            src="/nexvelt-logo.png" 
            alt="NexVelt Logo" 
            className="w-full h-full object-contain scale-105"
          />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Create your account</h1>
        <p className="mt-2 text-muted-foreground">Start running your restaurant with NexVelt</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="fullName" placeholder="John Doe" className="pl-10" {...register('fullName')} />
          </div>
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="email" type="email" placeholder="john@example.com" className="pl-10" {...register('email')} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="restaurantName">Initial Restaurant Name</Label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="restaurantName" placeholder="My Bistro" className="pl-10" {...register('restaurantName')} />
          </div>
          {errors.restaurantName && <p className="text-xs text-destructive">{errors.restaurantName.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" className="pl-10" {...register('password')} />
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold mt-2" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : (
            'Sign Up'
          )}
        </Button>
      </form>

      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link to={ROUTES.LOGIN} className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}
