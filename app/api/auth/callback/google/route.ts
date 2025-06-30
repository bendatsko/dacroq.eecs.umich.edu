// app/api/auth/callback/google/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isUserAuthorized } from '@/lib/auth-utils';

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

        if (!tokenResponse.ok) {
            console.error('Token exchange failed:', await tokenResponse.text());
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=token_exchange_failed`);
        }

        const tokens = await tokenResponse.json();

        // Get user info from Google
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        if (!userResponse.ok) {
            console.error('Failed to get user info:', await userResponse.text());
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=user_info_failed`);
        }

        const userData = await userResponse.json();

        // Check if user is authorized
        const authorizedUser = isUserAuthorized(userData.email);

        if (!authorizedUser) {
            console.log(`Unauthorized login attempt by: ${userData.email}`);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=unauthorized`);
        }

        // Create session data
        const sessionData = {
            id: userData.sub, // Google's unique user ID
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            isAdmin: authorizedUser.isAdmin,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
        };

        // Encode session token
        const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');

        // Set secure session cookie
        cookies().set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        console.log(`Successful login: ${userData.email}`);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);

    } catch (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/login?error=server_error`);
    }
}