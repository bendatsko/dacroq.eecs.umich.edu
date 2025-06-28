// lib/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface User {
    id: string;
    email: string;
    name: string;
    picture?: string;
    isAdmin?: boolean;
}

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => {},
    isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                console.log('Fetching user session data...');
                const response = await fetch('/api/auth/session');
                console.log('Session response status:', response.status);

                if (response.ok) {
                    const userData = await response.json();
                    console.log('Received user data:', userData);

                    if (userData && userData.id) {
                        console.log('Setting user data:', userData);
                        setUser(userData);
                        
                        // Check if we're on the login page and redirect if needed
                        if (window.location.pathname === '/login') {
                            router.push('/dashboard');
                        }
                    } else {
                        console.log('No valid user data in session, redirecting to login');
                        if (window.location.pathname !== '/login') {
                            router.push('/login');
                        }
                    }
                } else {
                    console.log('Session response not ok, redirecting to login');
                    if (window.location.pathname !== '/login') {
                        router.push('/login');
                    }
                }
            } catch (error) {
                console.error('Failed to fetch session:', error);
                if (window.location.pathname !== '/login') {
                    router.push('/login');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [router]);

    return (
        <AuthContext.Provider value={{ user, setUser, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);