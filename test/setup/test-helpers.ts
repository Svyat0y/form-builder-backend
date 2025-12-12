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
