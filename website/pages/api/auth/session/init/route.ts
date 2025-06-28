// app/api/auth/session/init/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { session } = await request.json();

        cookies().set({
            name: 'session',
            value: session,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 86400
        });

        return new NextResponse(null, { status: 200 });
    } catch (error) {
        return new NextResponse(null, { status: 500 });
    }
}