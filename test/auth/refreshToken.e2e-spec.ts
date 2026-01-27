import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Auth - Refresh Token (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  // Clear database before this test suite
  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Create authenticated user
      const { userData } = await createAuthenticatedUser(server());

      // Login with rememberMe to get refresh token in cookie
      const loginResponse = await request(server())
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
          rememberMe: true, // Important: request refresh token
        })
        .expect(200);

      // Extract refreshToken cookie from login response
      const setCookieHeader = loginResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();

      const cookies = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith('refreshToken='),
      );

      expect(refreshTokenCookie).toBeDefined();

      // Refresh tokens using cookie
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

      // Verify we got a valid access token
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

    // TODO: Add test for expired refresh token
    // This requires mocking JWT expiration or using very short-lived tokens
    // it('should return 401 with expired refresh token', async () => {
    //   // Implementation needed: mock time or use short-lived token
    // });
  });
});
