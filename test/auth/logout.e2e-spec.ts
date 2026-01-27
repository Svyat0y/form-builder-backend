import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Auth - Logout (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  // Clear database before this test suite
  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      // Create authenticated user with tokens
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      // Logout
      const logoutResponse = await request(server())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body).toEqual({
        message: 'Logged out successfully',
      });
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(server())
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await request(server())
        .post('/api/auth/logout')
        .set('Authorization', 'invalid-token-without-bearer')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });
});
