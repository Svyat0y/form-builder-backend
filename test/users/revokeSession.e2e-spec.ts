import request from 'supertest';
import { Server } from 'http';
import {
  getTestFixture,
  createAuthenticatedUser,
  generateUserData,
  registerUser,
  type AuthResponse,
  type UserTestData,
} from '../setup/jest-setup';

describe('Users - Sessions revocation (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  /**
   * Login uses a hash of User-Agent + IP subnet as the device fingerprint,
   * so distinct sessions for the same user require distinct User-Agent
   * headers (the default helper always logs in as the same "device").
   */
  /**
   * Access tokens are JWTs signed with second-granularity `iat` and no
   * jti, so two logins for the same user within the same second produce
   * byte-identical tokens (and thus indistinguishable DB rows). A short
   * delay guarantees each login in these tests gets a genuinely distinct
   * session token.
   */
  async function loginWithDevice(
    httpServer: Server,
    credentials: { email: string; password: string },
    userAgent: string,
  ): Promise<AuthResponse> {
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const response = await request(httpServer)
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send(credentials)
      .expect(200);

    return response.body as AuthResponse;
  }

  async function getSessions(httpServer: Server, accessToken: string) {
    const response = await request(httpServer)
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    return response.body as Array<{ id: string; current: boolean }>;
  }

  async function createUserWithTwoSessions(userData: UserTestData) {
    // registerUser only creates the account (no session); the two logins
    // below are then the only two sessions that exist for this user.
    await registerUser(server(), userData);

    const session1 = await loginWithDevice(
      server(),
      { email: userData.email, password: userData.password },
      'Device-One',
    );
    const session2 = await loginWithDevice(
      server(),
      { email: userData.email, password: userData.password },
      'Device-Two',
    );

    const sessions = await getSessions(server(), session2.user.accessToken);
    const otherSessionId = sessions.find((s) => !s.current)!.id;

    return { session1, session2, otherSessionId };
  }

  describe('DELETE /api/users/me/sessions/:id', () => {
    it("should revoke another one of the user's own sessions", async () => {
      const userData = generateUserData();
      const { session1, session2, otherSessionId } =
        await createUserWithTwoSessions(userData);

      const response = await request(server())
        .delete(`/api/users/me/sessions/${otherSessionId}`)
        .set('Authorization', `Bearer ${session2.user.accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Session revoked successfully',
      });

      // The revoked session's token can no longer authenticate
      const revokedCheck = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${session1.user.accessToken}`)
        .expect(401);
      expect(revokedCheck.body.statusCode).toBe(401);

      // The requesting session is unaffected and no longer lists the revoked one
      const remaining = await getSessions(server(), session2.user.accessToken);
      expect(remaining.some((s) => s.id === otherSessionId)).toBe(false);
    });

    it("should not revoke another user's session", async () => {
      const { authResponse: userA } = await createAuthenticatedUser(server());
      const { authResponse: userB } = await createAuthenticatedUser(server());

      const [bSession] = await getSessions(server(), userB.user.accessToken);

      const response = await request(server())
        .delete(`/api/users/me/sessions/${bSession.id}`)
        .set('Authorization', `Bearer ${userA.user.accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Session revoked successfully',
      });

      // User B's session must still be active/usable
      const stillActive = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${userB.user.accessToken}`)
        .expect(200);
      expect(stillActive.body.some((s) => s.id === bSession.id)).toBe(true);
    });

    it('should return 400 for a non-UUID session id', async () => {
      const { authResponse } = await createAuthenticatedUser(server());

      const response = await request(server())
        .delete('/api/users/me/sessions/not-a-uuid')
        .set('Authorization', `Bearer ${authResponse.user.accessToken}`)
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .delete('/api/users/me/sessions/550e8400-e29b-41d4-a716-446655440000')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });

  describe('POST /api/users/me/sessions/revoke-others', () => {
    it('should revoke all other sessions but keep the current one', async () => {
      const userData = generateUserData();
      await registerUser(server(), userData);

      const session1 = await loginWithDevice(
        server(),
        { email: userData.email, password: userData.password },
        'Device-One',
      );
      const session2 = await loginWithDevice(
        server(),
        { email: userData.email, password: userData.password },
        'Device-Two',
      );
      const session3 = await loginWithDevice(
        server(),
        { email: userData.email, password: userData.password },
        'Device-Three',
      );

      const response = await request(server())
        .post('/api/users/me/sessions/revoke-others')
        .set('Authorization', `Bearer ${session3.user.accessToken}`)
        .expect(201);

      expect(response.body).toEqual({
        message: 'Other sessions revoked successfully',
      });

      // Current session survives
      const remaining = await getSessions(server(), session3.user.accessToken);
      expect(remaining.length).toBe(1);
      expect(remaining[0].current).toBe(true);

      // The other sessions no longer authenticate
      const check1 = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${session1.user.accessToken}`)
        .expect(401);
      expect(check1.body.statusCode).toBe(401);

      const check2 = await request(server())
        .get('/api/users/me/sessions')
        .set('Authorization', `Bearer ${session2.user.accessToken}`)
        .expect(401);
      expect(check2.body.statusCode).toBe(401);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .post('/api/users/me/sessions/revoke-others')
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });
});
