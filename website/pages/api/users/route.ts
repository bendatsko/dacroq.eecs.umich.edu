// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { promises as fs } from 'fs';
import path from 'path';
import { ALLOWED_USERS } from '@/config/allowed-users';

// Helper to read current user session
async function getCurrentUser() {
    const sessionCookie = cookies().get('session');
    if (!sessionCookie) return null;

    try {
        return JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    } catch {
        return null;
    }
}

// Helper to update allowed users file
async function updateAllowedUsers(users: typeof ALLOWED_USERS) {
    const filePath = path.join(process.cwd(), 'config', 'allowed-users.ts');
    const fileContent = `export const ALLOWED_USERS = ${JSON.stringify(users, null, 2)};`;
    await fs.writeFile(filePath, fileContent, 'utf-8');
    return users;
}

export async function GET() {
    const currentUser = await getCurrentUser();

    if (!currentUser?.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(ALLOWED_USERS);
}

export async function POST(request: Request) {
    const currentUser = await getCurrentUser();

    if (!currentUser?.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, isAdmin } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const newUsers = [...ALLOWED_USERS, { email, isAdmin }];
    await updateAllowedUsers(newUsers);

    return NextResponse.json(newUsers);
}

export async function DELETE(request: Request) {
    const currentUser = await getCurrentUser();

    if (!currentUser?.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Prevent removing the last admin
    const remainingAdmins = ALLOWED_USERS.filter(u => u.isAdmin && u.email !== email);
    if (remainingAdmins.length === 0) {
        return NextResponse.json(
            { error: 'Cannot remove last admin' },
            { status: 400 }
        );
    }

    const newUsers = ALLOWED_USERS.filter(user => user.email !== email);
    await updateAllowedUsers(newUsers);

    return NextResponse.json(newUsers);
}

export async function PATCH(request: Request) {
    const currentUser = await getCurrentUser();

    if (!currentUser?.isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { email, isAdmin } = body;

    const newUsers = ALLOWED_USERS.map(user =>
        user.email === email ? { ...user, isAdmin } : user
    );

    await updateAllowedUsers(newUsers);

    return NextResponse.json(newUsers);
}