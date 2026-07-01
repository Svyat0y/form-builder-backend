import request from 'supertest';
import {
  getTestFixture,
  createAuthenticatedUser,
  type AuthResponse,
  type UserTestData,
} from '../setup/jest-setup';
import { UserRole } from '../../src/users/user.entity';

describe('Users - Admin Session Management (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  async function setRole(userId: string, role: UserRole): Promise<void> {
    await fixture.dataSource.getRepository('User').update(userId, { role });
  }

  /**
   * Creates an authenticated user and elevates their DB role afterwards.
   * RolesGuard re-reads the role from the DB on every request (it isn't
   * baked into the JWT), so the already-issued access token stays valid
   * after the elevation.
   */
  async function createUserWithRole(
    role: UserRole,
  ): Promise<{ userData: UserTestData; authResponse: AuthResponse }> {
    const { userData, authResponse } = await createAuthenticatedUser(server());
    if (role !== UserRole.USER) {
      await setRole(authResponse.user.id, role);
    }
    return { userData, authResponse };
  }

  async function getOwnSessionId(accessToken: string): Promise<string> {
    const response = await request(server())
      .get('/api/users/me/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    return response.body[0].id as string;
  }

  const nonExistentUserId = '00000000-0000-4000-8000-000000000000';
  const nonExistentSessionId = '00000000-0000-4000-8000-000000000001';

  describe('SUPER_ADMIN managing sessions of any role', () => {
    it.each([
      ['USER', UserRole.USER],
      ['ADMIN', UserRole.ADMIN],
      ['SUPER_ADMIN', UserRole.SUPER_ADMIN],
    ])(
      'can view, revoke a session, and revoke-all for a %s target',
      async (_label, targetRole) => {
        const { authResponse: superAdmin } = await createUserWithRole(
          UserRole.SUPER_ADMIN,
        );
        const { authResponse: target } = await createUserWithRole(targetRole);

        const listResponse = await request(server())
          .get(`/api/users/${target.user.id}/sessions`)
          .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
          .expect(200);

        expect(Array.isArray(listResponse.body)).toBe(true);
        expect(listResponse.body.length).toBeGreaterThan(0);
        const sessionId = listResponse.body[0].id as string;

        await request(server())
          .delete(`/api/users/${target.user.id}/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              message: 'Session revoked successfully',
            });
          });

        await request(server())
          .post(`/api/users/${target.user.id}/sessions/revoke-all`)
          .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
          .expect(201)
          .expect((res) => {
            expect(res.body).toEqual({
              message: 'All sessions revoked successfully',
            });
          });

        const finalSessions = await request(server())
          .get(`/api/users/${target.user.id}/sessions`)
          .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
          .expect(200);

        expect(finalSessions.body).toEqual([]);
      },
    );
  });

  describe('ADMIN managing sessions of a regular USER', () => {
    it('can view, revoke a session, and revoke-all for a USER target', async () => {
      const { authResponse: admin } = await createUserWithRole(UserRole.ADMIN);
      const { authResponse: target } = await createUserWithRole(UserRole.USER);

      const listResponse = await request(server())
        .get(`/api/users/${target.user.id}/sessions`)
        .set('Authorization', `Bearer ${admin.user.accessToken}`)
        .expect(200);

      expect(listResponse.body.length).toBeGreaterThan(0);
      const sessionId = listResponse.body[0].id as string;

      await request(server())
        .delete(`/api/users/${target.user.id}/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${admin.user.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            message: 'Session revoked successfully',
          });
        });

      await request(server())
        .post(`/api/users/${target.user.id}/sessions/revoke-all`)
        .set('Authorization', `Bearer ${admin.user.accessToken}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toEqual({
            message: 'All sessions revoked successfully',
          });
        });

      const finalSessions = await request(server())
        .get(`/api/users/${target.user.id}/sessions`)
        .set('Authorization', `Bearer ${admin.user.accessToken}`)
        .expect(200);

      expect(finalSessions.body).toEqual([]);
    });
  });

  describe('ADMIN forbidden from managing ADMIN/SUPER_ADMIN sessions', () => {
    it.each([
      ['ADMIN', UserRole.ADMIN],
      ['SUPER_ADMIN', UserRole.SUPER_ADMIN],
    ])(
      'returns 403 for GET/DELETE/revoke-all against a %s target',
      async (_label, targetRole) => {
        const { authResponse: admin } = await createUserWithRole(
          UserRole.ADMIN,
        );
        const { authResponse: target } = await createUserWithRole(targetRole);
        const sessionId = await getOwnSessionId(target.user.accessToken);

        const getRes = await request(server())
          .get(`/api/users/${target.user.id}/sessions`)
          .set('Authorization', `Bearer ${admin.user.accessToken}`)
          .expect(403);
        expect(getRes.body.message).toMatch(
          /Admins can only manage sessions of regular users/,
        );

        await request(server())
          .delete(`/api/users/${target.user.id}/sessions/${sessionId}`)
          .set('Authorization', `Bearer ${admin.user.accessToken}`)
          .expect(403);

        await request(server())
          .post(`/api/users/${target.user.id}/sessions/revoke-all`)
          .set('Authorization', `Bearer ${admin.user.accessToken}`)
          .expect(403);
      },
    );
  });

  describe('Regular USER forbidden from admin session endpoints', () => {
    it("returns 403 attempting to view/revoke/revoke-all another user's sessions", async () => {
      const { authResponse: actor } = await createUserWithRole(UserRole.USER);
      const { authResponse: target } = await createUserWithRole(UserRole.USER);
      const sessionId = await getOwnSessionId(target.user.accessToken);

      await request(server())
        .get(`/api/users/${target.user.id}/sessions`)
        .set('Authorization', `Bearer ${actor.user.accessToken}`)
        .expect(403);

      await request(server())
        .delete(`/api/users/${target.user.id}/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${actor.user.accessToken}`)
        .expect(403);

      await request(server())
        .post(`/api/users/${target.user.id}/sessions/revoke-all`)
        .set('Authorization', `Bearer ${actor.user.accessToken}`)
        .expect(403);
    });

    it('returns 401 attempting these endpoints without authentication', async () => {
      const { authResponse: target } = await createUserWithRole(UserRole.USER);

      await request(server())
        .get(`/api/users/${target.user.id}/sessions`)
        .expect(401);

      await request(server())
        .delete(`/api/users/${target.user.id}/sessions/${nonExistentSessionId}`)
        .expect(401);

      await request(server())
        .post(`/api/users/${target.user.id}/sessions/revoke-all`)
        .expect(401);
    });
  });

  describe('Edge cases: nonexistent session/user IDs', () => {
    it('revoking a nonexistent session ID for a real user is a no-op that still returns 200', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );
      const { authResponse: target } = await createUserWithRole(UserRole.USER);

      await request(server())
        .delete(`/api/users/${target.user.id}/sessions/${nonExistentSessionId}`)
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            message: 'Session revoked successfully',
          });
        });
    });

    it('returns 404 for GET sessions of a nonexistent userId', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );

      const res = await request(server())
        .get(`/api/users/${nonExistentUserId}/sessions`)
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 404 for DELETE session of a nonexistent userId', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );

      await request(server())
        .delete(
          `/api/users/${nonExistentUserId}/sessions/${nonExistentSessionId}`,
        )
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(404);
    });

    it('returns 404 for revoke-all of a nonexistent userId', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );

      await request(server())
        .post(`/api/users/${nonExistentUserId}/sessions/revoke-all`)
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(404);
    });

    it('returns 400 for a malformed (non-UUID) userId', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );

      await request(server())
        .get('/api/users/not-a-uuid/sessions')
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(400);
    });

    it('returns 400 for a malformed (non-UUID) sessionId', async () => {
      const { authResponse: superAdmin } = await createUserWithRole(
        UserRole.SUPER_ADMIN,
      );
      const { authResponse: target } = await createUserWithRole(UserRole.USER);

      await request(server())
        .delete(`/api/users/${target.user.id}/sessions/not-a-uuid`)
        .set('Authorization', `Bearer ${superAdmin.user.accessToken}`)
        .expect(400);
    });
  });
});
