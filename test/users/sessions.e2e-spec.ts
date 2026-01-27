import request from 'supertest';
import {
  getTestFixture,
  createAuthenticatedUser,
  generateUserData,
  loginUser,
  AuthResponse,
} from '../setup/jest-setup';

describe('Users - Sessions (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('GET /api/users/me/sessions', () => {
    it('should return active sessions for authenticated user', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      const session = response.body[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('deviceInfo');
      expect(session).toHaveProperty('deviceFingerprint');
      expect(session).toHaveProperty('lastUsed');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('expiresAt');
      expect(session).toHaveProperty('revoked');

      expect(typeof session.id).toBe('string');
      expect(typeof session.deviceInfo).toBe('string');
      expect(typeof session.deviceFingerprint).toBe('string');
      expect(typeof session.revoked).toBe('boolean');

      expect(session.revoked).toBe(false);

      expect(() => new Date(session.lastUsed).toISOString()).not.toThrow();
      expect(() => new Date(session.createdAt).toISOString()).not.toThrow();
      expect(() => new Date(session.expiresAt).toISOString()).not.toThrow();
    });

    it('should return multiple sessions after multiple logins from different devices', async () => {
      const userData = generateUserData();
      const { authResponse: firstLogin, userData: _ } =
        await createAuthenticatedUser(server(), userData);

      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      response.body.forEach((session) => {
        expect(session.revoked).toBe(false);
      });
    });

    it('should only return active (not revoked) sessions', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const initialResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

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

      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      const sessions = response.body;
      for (let i = 0; i < sessions.length - 1; i++) {
        const currentDate = new Date(sessions[i].lastUsed).getTime();
        const nextDate = new Date(sessions[i + 1].lastUsed).getTime();
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
    });

    it('should not exceed maximum session limit (10 sessions per user)', async () => {
      const userData = generateUserData();

      await createAuthenticatedUser(server(), userData);

      const logins: AuthResponse[] = [];
      for (let i = 0; i < 10; i++) {
        const login = await loginUser(server(), {
          email: userData.email,
          password: userData.password,
        });
        logins.push(login);
      }

      const lastLogin = logins[logins.length - 1];
      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${lastLogin.user.accessToken}`)
        .expect(200);

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
        expect(session.lastUsed).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );
        expect(session.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );
        expect(session.expiresAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
        );

        expect(() => new Date(session.lastUsed)).not.toThrow();
        expect(() => new Date(session.createdAt)).not.toThrow();
        expect(() => new Date(session.expiresAt)).not.toThrow();
      });
    });

    it('should return different deviceInfo/deviceFingerprint for different logins', async () => {
      const userData = generateUserData();

      const { authResponse: firstLogin, userData: _ } =
        await createAuthenticatedUser(server(), userData);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const secondLogin = await loginUser(server(), {
        email: userData.email,
        password: userData.password,
      });

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${secondLogin.user.accessToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);

      response.body.forEach((session) => {
        expect(session.deviceFingerprint).toBeTruthy();
        expect(typeof session.deviceFingerprint).toBe('string');
      });
    });

    it('should return consistent session data across multiple requests', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const firstResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const secondResponse = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(firstResponse.body.length).toBe(secondResponse.body.length);

      expect(firstResponse.body[0].id).toBe(secondResponse.body[0].id);
    });

    it('should handle Bearer token prefix correctly', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array when user has no active sessions', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
