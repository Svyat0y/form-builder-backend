import request from 'supertest';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  getTestFixture,
  createAuthenticatedUser,
  generateUserData,
} from '../setup/jest-setup';

describe('Users - Password (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  /**
   * OAuth-only accounts never have a password. There is no HTTP endpoint to
   * create one, so the user + a valid session are provisioned directly
   * against the DB (mirrors what the Google/Facebook OAuth callback does).
   * Raw SQL is used instead of the app's services/entities because Jest
   * gives each spec file its own module registry, so a class imported here
   * is not the same token the running app's DI container resolved with.
   */
  async function createOAuthOnlyUser(
    httpServer: Server,
  ): Promise<{ accessToken: string; email: string }> {
    const { email, name } = generateUserData();
    const userId = randomUUID();

    await fixture.dataSource.query(
      `INSERT INTO "user" (id, email, name, password, avatar, role) VALUES ($1, $2, $3, NULL, NULL, 'USER')`,
      [userId, email, name],
    );

    const accessToken = jwt.sign(
      { userId, email },
      process.env.JWT_SECRET as string,
      { expiresIn: '60m' },
    );

    // expiresAt is computed in JS (not via Postgres NOW()) to avoid any
    // clock/timezone skew between the DB container and the Node process.
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await fixture.dataSource.query(
      `INSERT INTO tokens (id, "accessToken", "refreshToken", "userId", "expiresAt", revoked, "deviceInfo", "ipAddress", "deviceFingerprint")
       VALUES ($1, $2, NULL, $3, $5, false, 'OAuth Test Device', '127.0.0.1', $4)`,
      [randomUUID(), accessToken, userId, `oauth-fixture-${userId}`, expiresAt],
    );

    return { accessToken, email };
  }

  describe('PATCH /api/users/me/password (change password)', () => {
    it('should change the password with a correct current password', async () => {
      const userData = generateUserData();
      const { authResponse } = await createAuthenticatedUser(
        server(),
        userData,
      );
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: userData.password,
          newPassword: 'NewPassword1',
        })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Password changed successfully',
      });

      // Old password no longer works
      const oldLogin = await request(server())
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password })
        .expect(401);
      expect(oldLogin.body.statusCode).toBe(401);

      // New password works
      const newLogin = await request(server())
        .post('/api/auth/login')
        .send({ email: userData.email, password: 'NewPassword1' })
        .expect(200);
      expect(newLogin.body.user.email).toBe(userData.email);
    });

    it('should return 401 when current password is incorrect', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword1',
          newPassword: 'NewPassword1',
        })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });

    it('should return 400 for a weak new password', async () => {
      const userData = generateUserData();
      const { authResponse } = await createAuthenticatedUser(
        server(),
        userData,
      );
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: userData.password,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 when the account has no password (OAuth-only)', async () => {
      const { accessToken } = await createOAuthOnlyUser(server());

      const response = await request(server())
        .patch('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'AnyPassword1',
          newPassword: 'NewPassword1',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .patch('/api/users/me/password')
        .send({
          currentPassword: 'Password123',
          newPassword: 'NewPassword1',
        })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });

  describe('POST /api/users/me/password (set password)', () => {
    it('should set a password for an OAuth-only account', async () => {
      const { accessToken, email } = await createOAuthOnlyUser(server());

      const response = await request(server())
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'BrandNewPass1' })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Password set successfully',
      });

      const login = await request(server())
        .post('/api/auth/login')
        .send({ email, password: 'BrandNewPass1' })
        .expect(200);
      expect(login.body.user.email).toBe(email);
    });

    it('should return 400 when the account already has a password', async () => {
      const userData = generateUserData();
      const { authResponse } = await createAuthenticatedUser(
        server(),
        userData,
      );
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'AnotherPass1' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 400 for a weak new password', async () => {
      const { accessToken } = await createOAuthOnlyUser(server());

      const response = await request(server())
        .post('/api/users/me/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ newPassword: 'weak' })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(server())
        .post('/api/users/me/password')
        .send({ newPassword: 'NewPassword1' })
        .expect(401);

      expect(response.body.statusCode).toBe(401);
    });
  });
});
