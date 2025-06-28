// app/api/auth/callback/google/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ALLOWED_USERS } from '@/config/allowed-users';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=auth_failed`);
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/callback/google`,
                grant_type: 'authorization_code',
            }).toString(),
        });

        const tokens = await tokenResponse.json();

        // Get user info - make sure to get the ID
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        const userData = await userResponse.json();

        // Check if user is in allowed list
        const authorizedUser = ALLOWED_USERS.find(user => user.email === userData.email);

        if (!authorizedUser) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=unauthorized`);
        }

        // Create session token with user ID
        const sessionToken = Buffer.from(JSON.stringify({
            id: userData.sub, // Google's unique user ID
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            isAdmin: authorizedUser.isAdmin,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        })).toString('base64');

        // Set cookie
        cookies().set('session', sessionToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
        });

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);
    } catch (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=server_error`);
    }
}