import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import { ALLOWED_USERS } from '@/config/allowed-users';
import { isUserAuthorized, validateSessionData } from '@/lib/auth-utils';

const CONFIG_PATH = path.join(process.cwd(), 'config/allowed-users.ts');

// Function to update last login timestamp for a user
async function updateLastLogin(email: string) {
    try {
        const userIndex = ALLOWED_USERS.findIndex(
            user => user.email.toLowerCase() === email.toLowerCase()
        );
        
        if (userIndex !== -1) {
            const updatedUsers = JSON.parse(JSON.stringify(ALLOWED_USERS));
            updatedUsers[userIndex].lastLogin = new Date().toISOString();
            
            const fileContent = `// This file is auto-generated. Do not edit manually.
export const ALLOWED_USERS = ${JSON.stringify(updatedUsers, null, 2)};
`;
            await fs.writeFile(CONFIG_PATH, fileContent, 'utf-8');
        }
    } catch (error) {
        console.error('Error updating last login:', error);
        // Don't fail the request if we can't update the timestamp
    }
}

export async function GET() {
    try {
        const sessionCookie = cookies().get('session');

        if (!sessionCookie) {
            return NextResponse.json(null);
        }

        // Decode and validate session data
        let sessionData;
        try {
            sessionData = JSON.parse(
                Buffer.from(sessionCookie.value, 'base64').toString()
            );
        } catch (error) {
            console.error('Invalid session token:', error);
            cookies().delete('session');
            return NextResponse.json(null);
        }

        // Validate session structure
        if (!validateSessionData(sessionData)) {
            console.error('Invalid session data structure');
            cookies().delete('session');
            return NextResponse.json(null);
        }

        // Check if session is expired
        if (sessionData.exp && Date.now() / 1000 > sessionData.exp) {
            cookies().delete('session');
            return NextResponse.json(null);
        }

        // Verify user is still authorized
        const authorizedUser = isUserAuthorized(sessionData.email);

        if (!authorizedUser) {
            console.log(`User no longer authorized: ${sessionData.email}`);
            cookies().delete('session');
            return NextResponse.json(null);
        }

        // Update last login timestamp (async, don't wait)
        updateLastLogin(sessionData.email);

        // Return user data
        return NextResponse.json({
            id: sessionData.id,
            email: sessionData.email,
            name: sessionData.name,
            picture: sessionData.picture,
            isAdmin: authorizedUser.isAdmin
        });

    } catch (error) {
        console.error('Session error:', error);
        cookies().delete('session');
        return NextResponse.json(null);
    }
}