import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Forms - Publish/Unpublish (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  async function createForm(accessToken: string) {
    const response = await request(server())
      .post('/api/forms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'My survey' })
      .expect(201);
    return response.body as { id: string };
  }

  describe('POST /api/forms/:id/publish', () => {
    it('should move a DRAFT form to ACTIVE and set publishedAt', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const form = await createForm(accessToken);

      const response = await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.status).toBe('ACTIVE');
      expect(response.body.publishedAt).toEqual(expect.any(String));
    });

    it('should return 400 when publishing an already ACTIVE form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const form = await createForm(accessToken);

      await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should move a CLOSED form back to ACTIVE without resetting publishedAt', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const form = await createForm(accessToken);

      const firstPublish = await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      const publishedAt = firstPublish.body.publishedAt;

      await request(server())
        .post(`/api/forms/${form.id}/unpublish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const republish = await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(republish.body.status).toBe('ACTIVE');
      expect(republish.body.publishedAt).toBe(publishedAt);
    });

    it('should return 403 when a non-owner tries to publish', async () => {
      const { authResponse: owner } = await createAuthenticatedUser(server());
      const { authResponse: other } = await createAuthenticatedUser(server());
      const form = await createForm(owner.user.accessToken);

      await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${other.user.accessToken}`)
        .expect(403);
    });
  });

  describe('POST /api/forms/:id/unpublish', () => {
    it('should move an ACTIVE form to CLOSED', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const form = await createForm(accessToken);

      await request(server())
        .post(`/api/forms/${form.id}/publish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const response = await request(server())
        .post(`/api/forms/${form.id}/unpublish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body.status).toBe('CLOSED');
    });

    it('should return 400 when unpublishing a DRAFT form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const form = await createForm(accessToken);

      await request(server())
        .post(`/api/forms/${form.id}/unpublish`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });
});
