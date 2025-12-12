import request from 'supertest';
import { E2ETestFixture } from '../setup/e2e-setup';
import {
  generateUserData,
  generateInvalidUserData,
  UserTestData,
} from '../setup/test-helpers';

describe('Auth - Registration (e2e)', () => {
  const fixture = new E2ETestFixture();

  beforeAll(async () => {
    await fixture.setup();
  });

  beforeEach(async () => {
    await fixture.clearDatabase();
  });

  afterAll(async () => {
    await fixture.teardown();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData: UserTestData = generateUserData();

      try {
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
      } catch (error) {
        console.log('Error response:', error.response?.body);
        throw error;
      }
    });

    it('should return 409 when email already exists', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'First User',
        password: 'Password123',
      };

      // First registration
      await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Second attempt with same email, different VALID password (<= 16 chars)
      const response = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'duplicate@example.com',
          name: 'Second User',
          password: 'Pass456',
        });

      console.log('Response status:', response.status);
      console.log('Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(409);
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
