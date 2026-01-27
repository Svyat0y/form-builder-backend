import request from 'supertest';
import {
  getTestFixture,
  generateUserData,
  generateInvalidUserData,
  registerUser,
  type UserTestData,
} from '../setup/jest-setup';

describe('Auth - Registration (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData: UserTestData = generateUserData();

      const response = await request(server())
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'User registered successfully',
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
          createdAt: expect.any(String),
        },
      });
    });

    it('should return 409 when email already exists', async () => {
      const userData = generateUserData();

      await registerUser(server(), userData);

      const response = await request(server())
        .post('/api/auth/register')
        .send({
          email: userData.email,
          name: 'Different Name',
          password: 'DifferentPass123',
        })
        .expect(409);

      expect(response.body).toMatchObject({
        statusCode: 409,
        message: 'User with this email already exists',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(server())
        .post('/api/auth/register')
        .send(invalidData.invalidEmail)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('email');
    });

    it('should return 400 for password that is too short', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(server())
        .post('/api/auth/register')
        .send(invalidData.shortPassword)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('password');
    });

    it('should return 400 for name with invalid characters', async () => {
      const invalidData = generateInvalidUserData();

      const response = await request(server())
        .post('/api/auth/register')
        .send(invalidData.invalidName)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toContain('name');
    });
  });
});
