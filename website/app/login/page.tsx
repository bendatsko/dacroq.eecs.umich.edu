"use client"

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [error, setError] = useState(null);
    const searchParams = useSearchParams();

    useEffect(() => {
        const errorMessage = searchParams.get('error');
        if (errorMessage) {
            setError(decodeURIComponent(errorMessage));
        }
    }, [searchParams]);

    useEffect(() => {
        const setVhProperty = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVhProperty();
        window.addEventListener('resize', setVhProperty);
        return () => window.removeEventListener('resize', setVhProperty);
    }, []);

    const handleGoogleLogin = () => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/auth/callback/google`;
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

        url.searchParams.append('client_id', clientId);
        url.searchParams.append('redirect_uri', redirectUri);
        url.searchParams.append('response_type', 'code');
        url.searchParams.append('scope', 'email profile');
        url.searchParams.append('prompt', 'select_account consent');

        window.location.href = url.toString();
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-2">
            <Card className="w-full max-w-[360px] shadow-none flex flex-col items-center py-12">
                <div className="mb-4 flex items-center">
                    <div className="w-[16px] h-[16px] bg-primary/90 flex items-center justify-center text-white mr-1">
                        <span className="text-[12px] text-fancy background dark:text-black">⭓</span>
                    </div>
                    <h1 className="text-2xl font-medium text-black dark:text-white">dacroq</h1>
                </div>

                <Button
                    onClick={handleGoogleLogin}
                    variant="outline"
                    className="w-[16rem] font-normal bg-white text-black dark:bg-black/10 dark:text-white border border-black/10 dark:border-white/10 shadow-none transition-all"
                >
                    <GoogleIcon />
                    <span>Sign in with Google</span>
                </Button>

                {error && (
                    <div className="w-[16rem] mt-4 text-center font-normal rounded-md bg-destructive/10 py-2 px-3 text-destructive text-sm flex items-center justify-center border border-destructive/20">
                        <AlertCircle className="h-4 w-4 flex-shrink-0 mr-2" />
                        {/* <span className="tracking-tight">Authentication failed.</span> */}
                        <span className="tracking-tight">Authentication servers are currently offline.</span>
                    </div>
                )}

               
            </Card>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="mr-2">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
    );
}