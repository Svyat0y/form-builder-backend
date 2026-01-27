# E2E Testing Guide

## 📋 Table of Contents
- [Test Structure](#test-structure)
- [Best Practices](#best-practices)
- [Database Cleanup Strategy](#database-cleanup-strategy)
- [Helpers and Utilities](#helpers-and-utilities)
- [Usage Examples](#usage-examples)

---

## 🏗️ Test Structure

```
test/
├── setup/
│   ├── e2e-setup.ts          # Test fixture class for managing test application
│   ├── global-setup.ts       # Global setup/teardown (runs once)
│   ├── global-teardown.ts    # Exports teardown from global-setup
│   ├── jest-setup.ts         # Setup for each test file
│   └── test-helpers.ts       # Helper functions and types
├── auth/                     # Tests for auth module
│   ├── registration.e2e-spec.ts
│   ├── login.e2e-spec.ts
│   ├── logout.e2e-spec.ts
│   └── refreshToken.e2e-spec.ts
├── app.e2e-spec.ts          # Basic application tests
├── app-test.module.ts       # NestJS test module
└── jest-e2e.json            # Jest configuration for e2e tests
```

---

## ✨ Best Practices

### 1. Single Application Instance

**✅ Correct:**
```typescript
// Global setup creates ONE instance for ALL tests
export default async function globalSetup() {
  const fixture = new E2ETestFixture();
  await fixture.setup();
  (global as any).__E2E_FIXTURE__ = fixture;
}
```

**❌ Incorrect:**
```typescript
// Creating new instance in each test (SLOW!)
beforeEach(async () => {
  const app = await createTestingModule();
  await app.init();
});
```

### 2. Unique Data for Each Test

**✅ Correct:**
```typescript
it('should register user', async () => {
  const userData = generateUserData(); // Unique email every time
  await registerUser(server(), userData);
});
```

**❌ Incorrect:**
```typescript
it('should register user', async () => {
  const userData = { email: 'test@test.com' }; // Fixed email - conflicts!
});
```

### 3. Using Helpers

**✅ Correct:**
```typescript
// Use ready-made helpers
const { user } = await registerUser(server());
const loginResponse = await loginUser(server(), {
  email: user.email,
  password: 'Password123'
});
```

**❌ Incorrect:**
```typescript
// Code duplication in every test
const response = await request(server())
  .post('/auth/register')
  .send(userData)
  .expect(201);
```

### 4. Database Cleanup

**✅ Correct:**
```typescript
describe('Auth - Login', () => {
  // Clear database once before all tests in suite
  beforeAll(async () => {
    await fixture.clearDatabase();
  });
  
  it('test 1', async () => {
    const userData = generateUserData(); // Unique data
  });
  
  it('test 2', async () => {
    const userData = generateUserData(); // Unique data
  });
});
```

**❌ Incorrect:**
```typescript
// Cleanup before each test - SLOW and unnecessary
beforeEach(async () => {
  await fixture.clearDatabase();
});
```

---

## 🗃️ Database Cleanup Strategy

### Current Approach

The database is **NOT** cleaned automatically. This is intentional for:

1. **Performance** - Database cleanup is a slow operation
2. **Isolation through unique data** - Each test uses unique emails
3. **Flexibility** - Can control cleanup manually

### When to Clean the Database?

#### ✅ In `beforeAll` for test suite

```typescript
describe('Auth - Registration', () => {
  beforeAll(async () => {
    await fixture.clearDatabase();
  });
  
  // All tests in this suite work with a clean database
});
```

#### ✅ In individual tests when needed

```typescript
it('should handle empty database', async () => {
  await fixture.clearDatabase();
  
  const users = await getUsersList(server());
  expect(users).toHaveLength(0);
});
```

#### ❌ DO NOT use `beforeEach`

```typescript
// AVOID - slow and often unnecessary
beforeEach(async () => {
  await fixture.clearDatabase();
});
```

---

## 🛠️ Helpers and Utilities

### Data Generators

#### `generateUserData(overrides?)`
Creates unique user data:

```typescript
const userData = generateUserData();
// {
//   email: 'test_1234567890_abc123@example.com',
//   name: 'Test User',
//   password: 'Password123'
// }

// With overrides
const customUser = generateUserData({ 
  name: 'Custom Name' 
});
```

#### `generateInvalidUserData()`
Returns invalid data for validation tests:

```typescript
const invalidData = generateInvalidUserData();
// {
//   invalidEmail: { email: 'invalid-email', ... },
//   shortPassword: { password: 'Ab1', ... },
//   invalidName: { name: 'Test123', ... }
// }
```

### API Helpers

#### `registerUser(server, userData?)`
Registers a new user:

```typescript
const authResponse = await registerUser(server());
// Returns AuthResponse with tokens

const customUser = await registerUser(server(), { 
  name: 'Custom' 
});
```

#### `loginUser(server, credentials)`
Login existing user:

```typescript
const authResponse = await loginUser(server(), {
  email: 'test@example.com',
  password: 'Password123'
});
```

#### `createAuthenticatedUser(server, userData?)`
Registers user and returns data + auth response:

```typescript
const { userData, authResponse } = await createAuthenticatedUser(server());

// Use user data
console.log(userData.email);

// Use tokens
const token = authResponse.user.accessToken;
```

---

## 📖 Usage Examples

### Simple Registration Test

```typescript
describe('Auth - Registration', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  it('should register new user', async () => {
    const userData = generateUserData();
    
    const response = await request(server())
      .post('/auth/register')
      .send(userData)
      .expect(201);

    expect(response.body.user.email).toBe(userData.email);
  });
});
```

### Test with Authentication

```typescript
describe('Protected endpoint', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  it('should access protected route', async () => {
    // Create authenticated user
    const { user } = await registerUser(server());
    
    // Use token for protected request
    const response = await request(server())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(response.body.email).toBe(user.email);
  });
});
```

### Test with Multiple Users

```typescript
it('should handle multiple users', async () => {
  // Create multiple users
  const user1 = await registerUser(server());
  const user2 = await registerUser(server());
  const user3 = await registerUser(server());

  // Thanks to unique emails, no conflicts
  expect(user1.user.email).not.toBe(user2.user.email);
  expect(user2.user.email).not.toBe(user3.user.email);
});
```

### Validation Test

```typescript
it('should return 400 for invalid data', async () => {
  const invalidData = generateInvalidUserData();
  
  const response = await request(server())
    .post('/auth/register')
    .send(invalidData.invalidEmail)
    .expect(400);

  expect(response.body.message).toBe('Validation failed');
  expect(response.body.errors[0].field).toBe('email');
});
```

---

## 🚀 Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run in watch mode
npm run test:e2e -- --watch

# Run specific file
npm run test:e2e -- registration.e2e-spec.ts

# Run with coverage
npm run test:e2e -- --coverage
```

---

## 🐳 Test Database

### Starting Test Database

```bash
# Start Docker container with test database
npm run test:e2e:db:up

# Stop and remove container
npm run test:e2e:db:down
```

### Configuration

```typescript
// test/app-test.module.ts
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5433,              // Separate port for tests
  database: 'form_builder_test',
  synchronize: true,       // Automatic schema creation
  // ...
})
```

---

## 🔍 Troubleshooting

### Tests fail with "Global fixture not initialized" error

**Cause:** Global setup did not complete successfully.

**Solution:**
1. Check that test database is running: `npm run test:e2e:db:up`
2. Check database connection settings in `app-test.module.ts`

### Tests fail with "cannot truncate a table referenced in a foreign key constraint"

**Cause:** PostgreSQL prevents truncating tables with foreign key constraints.

**Solution:**
This has been fixed in `e2e-setup.ts` by temporarily disabling foreign key checks during cleanup:
```typescript
await this.dataSource.query('SET session_replication_role = replica;');
// ... clear tables ...
await this.dataSource.query('SET session_replication_role = DEFAULT;');
```

If you still see this error, ensure you're using the latest version of `clearDatabase()` method.

### Tests run slowly

**Cause:** Possibly using database cleanup in `beforeEach`.

**Solution:**
1. Use `beforeAll` instead of `beforeEach`
2. Use unique data instead of database cleanup
3. Group related tests in one `describe` block

### Data conflicts between tests

**Cause:** Using fixed data (email, id, etc.).

**Solution:**
1. Use `generateUserData()` to create unique data
2. Add `beforeAll` with database cleanup for test suite

---

## 📚 Additional Resources

- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

---

**Last updated:** January 27, 2026
