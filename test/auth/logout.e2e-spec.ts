import request from 'supertest';
import { getTestFixture, generateUserData } from '../setup/jest-setup';

describe('Auth - Logout (e2e)', () => {
  const fixture = getTestFixture();

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const userData = generateUserData();

      const registerResponse = await request(fixture.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      const accessToken = registerResponse.body.user.accessToken;

      const logoutResponse = await request(fixture.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body).toEqual({
        message: 'Logged out successfully',
      });
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/logout')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Unauthorized',
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    // Optional: Test with malformed token (no "Bearer ")
    it('should return 401 with malformed authorization header', async () => {
      const response = await request(fixture.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'invalid-token-without-bearer')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });
});
