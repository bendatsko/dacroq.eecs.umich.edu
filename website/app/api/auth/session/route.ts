// app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import { ALLOWED_USERS } from '@/config/allowed-users';

// Corrected path - removed the 'src/' prefix
const CONFIG_PATH = path.join(process.cwd(), 'config/allowed-users.ts');

// Function to write updated users back to config
async function writeUsersToConfig(users: any[]) {
    try {
        const fileContent = `// This file is auto-generated. Do not edit manually.
export const ALLOWED_USERS = ${JSON.stringify(users, null, 2)};
`;
        console.log(`Writing to: ${CONFIG_PATH}`);
        await fs.writeFile(CONFIG_PATH, fileContent, 'utf-8');
        console.log('Successfully wrote to config file');
        return true;
    } catch (error) {
        console.error('Error writing to config file:', error);
        return false;
    }
}

export async function GET() {
    try {
        const sessionCookie = cookies().get('session');

        if (!sessionCookie) {
            return NextResponse.json(null);
        }

        const sessionData = JSON.parse(
            Buffer.from(sessionCookie.value, 'base64').toString()
        );

        // Update last login timestamp if the user exists in ALLOWED_USERS
        if (sessionData.email) {
            // Make sure to do a case-insensitive comparison
            const userIndex = ALLOWED_USERS.findIndex(
                user => user.email.toLowerCase() === sessionData.email.toLowerCase()
            );
            
            if (userIndex !== -1) {
                // Create a deep copy of the users array
                const updatedUsers = JSON.parse(JSON.stringify(ALLOWED_USERS));
                
                // Update the lastLogin timestamp
                updatedUsers[userIndex] = {
                    ...updatedUsers[userIndex],
                    lastLogin: new Date().toISOString()
                };
                
                // Write the updated users back to the config file
                await writeUsersToConfig(updatedUsers);
            }
        }

        // Return the session data as before
        return NextResponse.json({
            id: sessionData.id,
            email: sessionData.email,
            name: sessionData.name,
            picture: sessionData.picture,
            isAdmin: sessionData.isAdmin
        });
    } catch (error) {
        console.error('Session fetch error:', error);
        return NextResponse.json(null);
    }
}