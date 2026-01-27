import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Auth - Refresh Token (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const { userData } = await createAuthenticatedUser(server());

      const loginResponse = await request(server())
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
          rememberMe: true,
        })
        .expect(200);

      const setCookieHeader = loginResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();

      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );

      expect(refreshTokenCookie).toBeDefined();

      const refreshResponse = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', refreshTokenCookie!)
        .expect(200);

      expect(refreshResponse.body).toEqual({
        message: 'Tokens refreshed successfully',
        user: {
          id: loginResponse.body.user.id,
          email: loginResponse.body.user.email,
          name: loginResponse.body.user.name,
          createdAt: expect.any(String),
          accessToken: expect.any(String),
        },
      });

      expect(refreshResponse.body.user.accessToken).toBeDefined();
      expect(refreshResponse.body.user.accessToken.length).toBeGreaterThan(0);
    });

    it('should return 401 with invalid refresh token', async () => {
      const response = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid-token'])
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Invalid refresh token',
      });
    });
  });
});
