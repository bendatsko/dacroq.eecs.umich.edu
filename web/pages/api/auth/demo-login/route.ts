// app/api/auth/demo-login/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const sessionToken = Buffer.from(JSON.stringify({
        id: `demo-${Date.now()}`,
        email: 'demo@umich.edu',
        name: 'Sponsor Demo',
        picture: '',
        isAdmin: false,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    })).toString('base64');

    cookies().set('session', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);
}