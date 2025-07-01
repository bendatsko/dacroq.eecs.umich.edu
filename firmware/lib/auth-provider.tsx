// lib/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/firmware/lib/auth-utils';

interface AuthContextType {
    user: User;
    login: () => void;
    logout: () => void;
    isLoading: boolean;
    isGuest: boolean;
}

const defaultUser: User = {
    id: 'guest',
    email: 'guest@dacroq.local',
    name: 'Guest User',
    picture: undefined,
    isAdmin: false
};

const AuthContext = createContext<AuthContextType>({
    user: defaultUser,
    login: () => {},
    logout: () => {},
    isLoading: false,
    isGuest: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User>(defaultUser);
    const [isLoading, setIsLoading] = useState(false);
    const [isGuest, setIsGuest] = useState(true);
    const router = useRouter();

    const login = () => {
        const googleAuthUrl = `https://accounts.google.com/oauth/authorize?` +
            `client_id=${process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_URL + '/api/auth/callback/google')}&` +
            `scope=${encodeURIComponent('openid email profile')}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent`;
        
        window.location.href = googleAuthUrl;
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setUser(defaultUser);
            setIsGuest(true);
            router.push('/dashboard');
        } catch (error) {
            console.error('Logout error:', error);
            // Even if the server request fails, clear local state
            setUser(defaultUser);
            setIsGuest(true);
            router.push('/dashboard');
        }
    };

    useEffect(() => {
        const fetchUserSession = async () => {
            try {
                setIsLoading(true);
                const response = await fetch('/api/auth/session');
                
                if (response.ok) {
                    const userData = await response.json();
                    if (userData && userData.email && userData.email !== 'guest@dacroq.local') {
                        setUser(userData);
                        setIsGuest(false);
                    } else {
                        // No valid session, use guest user
                        setUser(defaultUser);
                        setIsGuest(true);
                    }
                } else {
                    // Session invalid, use guest user
                    setUser(defaultUser);
                    setIsGuest(true);
                }
            } catch (error) {
                console.error('Failed to fetch session:', error);
                // On error, use guest user
                setUser(defaultUser);
                setIsGuest(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserSession();
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading, isGuest }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);