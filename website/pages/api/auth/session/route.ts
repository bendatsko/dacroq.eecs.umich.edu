// app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const sessionCookie = cookies().get('session');

        if (!sessionCookie) {
            return NextResponse.json(null);
        }

        const sessionData = JSON.parse(
            Buffer.from(sessionCookie.value, 'base64').toString()
        );

        // Make sure to include ID in the response
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