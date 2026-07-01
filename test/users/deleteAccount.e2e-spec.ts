import request from 'supertest';
import {
  getTestFixture,
  createAuthenticatedUser,
  generateUserData,
  loginUser,
} from '../setup/jest-setup';

describe('Users - Self Delete (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('DELETE /api/users/me', () => {
    it('should delete the current user account', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Account deleted successfully',
      });
    });

    it('should no longer be able to login after self-delete', async () => {
      const userData = generateUserData();
      const { authResponse } = await createAuthenticatedUser(
        server(),
        userData,
      );
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const response = await request(server())
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should invalidate the session token after account is deleted (cascade)', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Deleting the user cascades to its tokens, so the old access token
      // is rejected at the auth guard (401) before ever reaching the
      // handler that would otherwise 404 on a missing user.
      const response = await request(server())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .delete('/api/users/me')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(server())
        .delete('/api/users/me')
        .set('Authorization', 'Bearer invalid-token-123')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should not affect other users when one deletes their account', async () => {
      const { authResponse: victim } = await createAuthenticatedUser(server());
      const otherUserData = generateUserData();
      const { authResponse: other } = await createAuthenticatedUser(
        server(),
        otherUserData,
      );

      await request(server())
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${victim.user.accessToken}`)
        .expect(200);

      const response = await request(server())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${other.user.accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(otherUserData.email);
    });
  });
});
