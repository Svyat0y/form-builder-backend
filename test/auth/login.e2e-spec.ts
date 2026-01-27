import request from 'supertest';
import {
  getTestFixture,
  registerUser,
  loginUser,
  generateUserData,
} from '../setup/jest-setup';

describe('Auth - Login (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  // Clear database before this test suite
  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      // Create user using helper
      const userData = generateUserData();
      await registerUser(server(), userData);

      // Login with credentials
      const response = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      expect(response).toEqual({
        message: 'Login successful',
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
          createdAt: expect.any(String),
          accessToken: expect.any(String),
        },
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(server())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should return 401 for wrong password', async () => {
      const userData = generateUserData();
      await registerUser(server(), userData);

      const response = await request(server())
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(server())
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('email');
    });

    it('should return 400 for empty password', async () => {
      const response = await request(server())
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('password');
    });
  });
});
