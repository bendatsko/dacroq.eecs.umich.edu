import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    try {
        // Clear main session cookie
        cookies().delete('session');

        // Clear Google OAuth cookies
        cookies().delete('next-auth.session-token');
        cookies().delete('next-auth.callback-url');
        cookies().delete('next-auth.csrf-token');

        // Send response that will trigger client-side redirect
        return NextResponse.json({
            success: true,
            // You might want to redirect to login or home page
            redirect: '/auth/signin'
        });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}