// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { ALLOWED_USERS } from '@/config/allowed-users';

const CONFIG_PATH = path.join(process.cwd(), 'src/config/allowed-users.ts');

// Function to write users to config file
async function writeUsersToConfig(users: any[]) {
  const fileContent = `// This file is auto-generated. Do not edit manually.
export const ALLOWED_USERS = ${JSON.stringify(users, null, 2)};
`;
  await fs.writeFile(CONFIG_PATH, fileContent, 'utf-8');
  return users;
}

// GET handler to retrieve all users
export async function GET(request: NextRequest) {
  try {
    // Verify the user is authenticated and is an admin
    const session = cookies().get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In a real app, you'd verify the session and check admin status
    // For now, we'll just return the ALLOWED_USERS list
    return NextResponse.json(ALLOWED_USERS);
  } catch (error) {
    console.error('Error getting users:', error);
    return NextResponse.json({ error: 'Failed to get users' }, { status: 500 });
  }
}

// POST handler to add a new user
export async function POST(request: NextRequest) {
  try {
    // Verify the user is authenticated and is an admin
    const session = cookies().get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { email, isAdmin } = data;

    if (!email || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Check if the email is already in the list
    const userExists = ALLOWED_USERS.some(user => user.email === email);
    if (userExists) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    // Add the new user
    const updatedUsers = [...ALLOWED_USERS, { email, isAdmin }];
    
    // Write the updated list back to the config file
    await writeUsersToConfig(updatedUsers);

    return NextResponse.json(updatedUsers);
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

// PATCH handler to update a user
export async function PATCH(request: NextRequest) {
  try {
    // Verify the user is authenticated and is an admin
    const session = cookies().get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { email, isAdmin } = data;

    if (!email || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Find and update the user
    const updatedUsers = ALLOWED_USERS.map(user => 
      user.email === email ? { ...user, isAdmin } : user
    );

    // Check if user was found and updated
    if (JSON.stringify(updatedUsers) === JSON.stringify(ALLOWED_USERS)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Write the updated list back to the config file
    await writeUsersToConfig(updatedUsers);

    return NextResponse.json(updatedUsers);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE handler to remove a user
export async function DELETE(request: NextRequest) {
  try {
    // Verify the user is authenticated and is an admin
    const session = cookies().get('session')?.value;
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { email } = data;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Filter out the user to be deleted
    const updatedUsers = ALLOWED_USERS.filter(user => user.email !== email);

    // Check if user was found and removed
    if (updatedUsers.length === ALLOWED_USERS.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Write the updated list back to the config file
    await writeUsersToConfig(updatedUsers);

    return NextResponse.json(updatedUsers);
  } catch (error) {
    console.error('Error removing user:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}