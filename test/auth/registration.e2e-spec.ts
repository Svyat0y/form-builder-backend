import request from 'supertest';
import {
  getTestFixture,
  generateUserData,
  generateInvalidUserData,
  type UserTestData,
} from '../setup/jest-setup';

describe('Auth - Registration (e2e)', () => {
  const fixture = getTestFixture();

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData: UserTestData = generateUserData();

      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'User registered successfully',
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

    it('should return 409 when email already exists', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'First User',
        password: 'Password123',
      };

      await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          name: 'Second User',
          password: 'Pass456',
        })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'User with this email already exists',
        error: 'Conflict',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(invalidData.invalidEmail)
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].field).toBe('email');
    });

    it('should return 400 for password that is too short', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(invalidData.shortPassword)
        .expect(400);

      expect(response.body.errors[0].field).toBe('password');
    });

    it('should return 400 for name with invalid characters', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(invalidData.invalidName)
        .expect(400);

      expect(response.body.errors[0].field).toBe('name');
    });
  });
});
