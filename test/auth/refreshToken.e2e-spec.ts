import request from 'supertest';
import { getTestFixture, generateUserData } from '../setup/jest-setup';

describe('Auth - Refresh Token (e2e)', () => {
  const fixture = getTestFixture();

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const userData = generateUserData();
      const registerResponse = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const refreshToken = registerResponse.body.user.refreshToken;

      const refreshResponse = await request(fixture.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toEqual({
        message: 'Tokens refreshed successfully',
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

    it('should return 401 with invalid refresh token', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Invalid refresh token',
        error: 'Unauthorized',
      });
    });

    // it('should return 401 with expired refresh token', async () => {
    //   pending('Need to mock JWT expiration');
    // });
  });
});