// lib/auth-utils.ts
import { ALLOWED_USERS } from '@/config/allowed-users';

export interface User {
    id: string;
    email: string;
    name: string;
    picture?: string;
    isAdmin?: boolean;
}

export interface SessionData extends User {
    exp?: number; // Session expiry timestamp
}

export interface AllowedUser {
    email: string;
    isAdmin: boolean;
    lastLogin: string | null;
}

/**
 * Check if a user is authorized to access the platform
 */
export function isUserAuthorized(email: string): AllowedUser | null {
    return ALLOWED_USERS.find(user => 
        user.email.toLowerCase() === email.toLowerCase()
    ) || null;
}

/**
 * Check if a user has admin privileges
 */
export function isUserAdmin(email: string): boolean {
    const user = isUserAuthorized(email);
    return user?.isAdmin || false;
}

/**
 * Get all authorized users (admin function)
 */
export function getAllowedUsers(): AllowedUser[] {
    return ALLOWED_USERS;
}

/**
 * Validate session data structure
 */
export function validateSessionData(sessionData: any): sessionData is SessionData {
    return (
        sessionData &&
        typeof sessionData.id === 'string' &&
        typeof sessionData.email === 'string' &&
        typeof sessionData.name === 'string' &&
        (sessionData.exp === undefined || typeof sessionData.exp === 'number')
    );
}
