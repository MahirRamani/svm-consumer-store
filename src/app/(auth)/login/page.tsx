// app/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';

  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const result = await signIn('credentials', {
        username: formData.username, // Changed from userId
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid username or password');
      } else if (result?.ok) {
        router.push('/user/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null); // Clear error on input change
  };
  
  return (
    <div className="min-h-screen flex">
      {/* Left Side - GIF/Image Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 text-center text-white max-w-md">
          {/* Replace this with your actual GIF */}
          <div className="mb-8 relative w-full h-80 bg-white/10 rounded-2xl backdrop-blur-sm overflow-hidden">
            <Image
            src="/images/login-animation.gif"
            alt="Login Animation"
            fill
            className="object-contain p-8"
            priority
            />
          </div>

          <h1 className="text-4xl font-bold mb-4">Welcome Back!</h1>
          <p className="text-lg text-white/90 mb-2">
            Hostel Store Management System
          </p>
          <p className="text-sm text-white/70">
            Manage your inventory, sales, and transactions efficiently
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
              <p className="text-gray-600">Enter your credentials to access your account</p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  className="h-12 text-base"
                  disabled={isLoading}
                  />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter your password"
                    className="h-12 text-base pr-12"
                    disabled={isLoading}
                    />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// import React from 'react'

// function login() {
  //   return (
    //     <div>login</div>
    //   )
    // }
    
    // export default login
    // const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    //   e.preventDefault();
    //   setError(null);
    //   setIsLoading(true);
    
    //   try {
    //     const result = await signIn('credentials', {
    //       username: formData.username,
    //       password: formData.password,
    //       redirect: false,
    //     });
    
    //     if (result?.error) {
    //       setError('Invalid username or password');
    //     } else if (result?.ok) {
    //       router.push('/admin/dashboard');
    //       router.refresh();
    //     }
    //   } catch (err) {
    //     setError('An unexpected error occurred. Please try again.');
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    
    // const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    //   e.preventDefault();
    //   setError(null);
    //   setIsLoading(true);
    
    //   try {
    //     const result = await signIn('credentials', {
    //       username: formData.username,
    //       password: formData.password,
    //       redirect: false,
    //     });
    
    //     if (result?.error) {
    //       setError('Invalid username or password');
    //     } else if (result?.ok) {
    //       // Redirect to callback URL or default dashboard
    //       router.push(callbackUrl);
    //       router.refresh();
    //     }
    //   } catch (err) {
    //     setError('An unexpected error occurred. Please try again.');
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };