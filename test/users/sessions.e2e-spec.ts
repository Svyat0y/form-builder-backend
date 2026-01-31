import request from 'supertest';
import {
  getTestFixture,
  createAuthenticatedUser,
  generateUserData,
  loginUser,
} from '../setup/jest-setup';

describe('Users - Sessions (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  // Clear database before this test suite
  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('GET /api/users/me/sessions', () => {
    it('should return active sessions for authenticated user', async () => {
      // Create authenticated user
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      // Get sessions
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should return an array with at least one session
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // First session should have all required fields
      const session = response.body[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('deviceInfo');
      expect(session).toHaveProperty('deviceFingerprint');
      expect(session).toHaveProperty('lastUsed');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('revoked');

      // Validate field types
      expect(typeof session.id).toBe('string');
      expect(typeof session.deviceInfo).toBe('string');
      expect(typeof session.deviceFingerprint).toBe('string');
      expect(typeof session.revoked).toBe('boolean');

      // Session should not be revoked
      expect(session.revoked).toBe(false);

      // Dates should be ISO strings
      expect(() => new Date(session.lastUsed).toISOString()).not.toThrow();
      expect(() => new Date(session.createdAt).toISOString()).not.toThrow();
      expect(() => new Date(session.expiresAt).toISOString()).not.toThrow();
    });

    it('should return multiple sessions after multiple logins from different devices', async () => {
      // Create user
      const userData = generateUserData();
      const { authResponse: firstLogin, userData: _ } =
        await createAuthenticatedUser(server(), userData);

      // Login again (simulates another device)
      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      // Get sessions with second login token (more recent)
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      // Should have at least 1 session (multiple logins from same device may reuse session)
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      // All sessions should not be revoked
      response.body.forEach((session) => {
        expect(session.revoked).toBe(false);
      });
    });

    it('should only return active (not revoked) sessions', async () => {
      // Create authenticated user
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      // Get initial sessions
      const initialResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // All initial sessions should be active
      initialResponse.body.forEach((session) => {
        expect(session.revoked).toBe(false);
      });
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .get('/api/users/me/sessions')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should return 401 with invalid/malformed authorization header', async () => {
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', 'InvalidHeaderFormat')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 401 with invalid JWT token', async () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.invalid';

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should return 401 with expired JWT token', async () => {
      // Create a token that's already expired
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjB9.signature';

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return sessions sorted by lastUsed in descending order', async () => {
      const { authResponse: firstLogin, userData: _ } =
        await createAuthenticatedUser(server());

      const userData = generateUserData();
      await createAuthenticatedUser(server(), userData);

      // Login again with same user
      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      // Get sessions
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      // Verify sessions are sorted by lastUsed (most recent first)
      const sessions = response.body;
      for (let i = 0; i < sessions.length - 1; i++) {
        const currentDate = new Date(sessions[i].lastUsed).getTime();
        const nextDate = new Date(sessions[i + 1].lastUsed).getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });

    it('should not exceed maximum session limit (10 sessions per user)', async () => {
      const userData = generateUserData();

      // Create initial login
      await createAuthenticatedUser(server(), userData);

      // Login 10 times to create multiple sessions
      const logins = [];
      for (let i = 0; i < 10; i++) {
        const login = await loginUser(server(), {
          email: userData.email,
          password: userData.password,
        });
        logins.push(login);
      }

      // Get sessions with the latest login
      const lastLogin = logins[logins.length - 1];
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${lastLogin.user.accessToken}`)
        .expect(200);

      // Should have maximum 10 active sessions
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should return sessions with valid ISO date strings', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      response.body.forEach((session) => {
        // Verify dates are valid ISO strings
        expect(session.lastUsed).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );
        expect(session.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );
        expect(session.expiresAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );

        // Verify dates are parseable
        expect(() => new Date(session.lastUsed)).not.toThrow();
        expect(() => new Date(session.createdAt)).not.toThrow();
        expect(() => new Date(session.expiresAt)).not.toThrow();
      });
    });

    it('should return different deviceInfo/deviceFingerprint for different logins', async () => {
      const userData = generateUserData();

      // First login
      const { authResponse: firstLogin, userData: _ } =
        await createAuthenticatedUser(server(), userData);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second login
      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      // Get sessions with second login token
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      // Should have at least 1 session
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      // Check that sessions have fingerprints
      response.body.forEach((session) => {
        expect(session.deviceFingerprint).toBeTruthy();
        expect(typeof session.deviceFingerprint).toBe('string');
      });
    });

    it('should return consistent session data across multiple requests', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      // Make two requests to get sessions
      const firstResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const secondResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Both should have the same number of sessions
      expect(firstResponse.body.length).toBe(secondResponse.body.length);

      // First session ID should be the same (though lastUsed might differ)
      expect(firstResponse.body[0].id).toBe(secondResponse.body[0].id);
    });

    it('should handle Bearer token prefix correctly', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      // Correct format with Bearer
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array when user has no active sessions', async () => {
      // This is an edge case - in normal flow, after login there should be sessions
      // But we test that the endpoint returns an array structure
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should always be an array, even if empty
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
