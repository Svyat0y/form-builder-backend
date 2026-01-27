import request from 'supertest';
import { Server } from 'http';

export interface UserTestData {
  email: string;
  name: string;
  password: string;
}

export interface InvalidUserData {
  invalidEmail: UserTestData;
  shortPassword: UserTestData;
  invalidName: UserTestData;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
  };
}

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    accessToken: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Generate unique user data for tests
 * Uses timestamp + random string to ensure uniqueness
 */
export function generateUserData(
  overrides: Partial<UserTestData> = {},
): UserTestData {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    email: `test_${uniqueId}@example.com`,
    name: 'Test User',
    password: 'Password123',
    ...overrides,
  };
}

/**
 * Generate invalid user data for validation tests
 */
export function generateInvalidUserData(): InvalidUserData {
  return {
    invalidEmail: {
      email: 'invalid-email',
      name: 'Test User',
      password: 'Password123',
    },

    shortPassword: {
      email: 'test@example.com',
      name: 'Test User',
      password: 'Ab1',
    },

    invalidName: {
      email: 'test@example.com',
      name: 'Test123',
      password: 'Password123',
    },
  };
}

/**
 * Register a new user
 * Note: Registration does NOT return tokens, only user info
 * @returns Register response with user info (no tokens)
 */
export async function registerUser(
  server: Server,
  userData?: Partial<UserTestData>,
): Promise<RegisterResponse> {
  const user = generateUserData(userData);

  const response = await request(server)
    .post('/api/auth/register')
    .send(user)
    .expect(201);

  return response.body as RegisterResponse;
}

/**
 * Login existing user
 * @returns Auth response with tokens
 */
export async function loginUser(
  server: Server,
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  const response = await request(server)
    .post('/api/auth/login')
    .send(credentials)
    .expect(200);

  return response.body as AuthResponse;
}

/**
 * Register and login user in one step
 * Useful for tests that need authenticated user with tokens
 */
export async function createAuthenticatedUser(
  server: Server,
  userData?: Partial<UserTestData>,
): Promise<{ userData: UserTestData; authResponse: AuthResponse }> {
  const user = generateUserData(userData);

  await registerUser(server, user);

  const authResponse = await loginUser(server, {
    email: user.email,
    password: user.password,
  });

  return {
    userData: user,
    authResponse,
  };
}
