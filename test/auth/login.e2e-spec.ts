import request from 'supertest';
import { getTestFixture, generateUserData } from '../setup/jest-setup';

describe('Auth - Login (e2e)', () => {
  const fixture = getTestFixture();

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const userData = generateUserData();

      await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const response = await request(fixture.getHttpServer())
        .post('/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Login successful',
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
          createdAt: expect.any(String),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    });

    it('should return 401 for wrong password', async () => {
      const userData = generateUserData();

      await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const response = await request(fixture.getHttpServer())
        .post('/auth/login')
        .send({
          email: userData.email,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].field).toBe('email');
    });

    it('should return 400 for empty password', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: '',
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe('password');
    });
  });
});
