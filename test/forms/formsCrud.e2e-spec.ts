import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Forms - CRUD (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  describe('POST /api/forms', () => {
    it('should create a form in DRAFT status with empty fields', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const response = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'My survey',
        status: 'DRAFT',
        fields: [],
        responsesCount: 0,
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('should return 400 when title is missing', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should return 401 without authorization header', async () => {
      await request(server())
        .post('/api/forms')
        .send({ title: 'My survey' })
        .expect(401);
    });
  });

  describe('GET /api/forms', () => {
    it("should list only the current user's forms, newest updated first", async () => {
      const { authResponse: owner } = await createAuthenticatedUser(server());
      const ownerToken = owner.user.accessToken;
      const { authResponse: other } = await createAuthenticatedUser(server());
      const otherToken = other.user.accessToken;

      await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Form A' })
        .expect(201);

      const second = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Form B' })
        .expect(201);

      await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: "Someone else's form" })
        .expect(201);

      const response = await request(server())
        .get('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].id).toBe(second.body.id);
      expect(
        response.body.items.every((f: { title: string }) =>
          ['Form A', 'Form B'].includes(f.title),
        ),
      ).toBe(true);
    });

    it('paginates with page/limit and reports total across all pages', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      for (let i = 0; i < 5; i++) {
        await request(server())
          .post('/api/forms')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ title: `Paginated form ${i}` })
          .expect(201);
      }

      const firstPage = await request(server())
        .get('/api/forms?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(firstPage.body.items).toHaveLength(2);
      expect(firstPage.body.total).toBe(5);
      expect(firstPage.body.page).toBe(1);
      expect(firstPage.body.limit).toBe(2);

      const secondPage = await request(server())
        .get('/api/forms?page=2&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(secondPage.body.items).toHaveLength(2);
      const firstPageIds = firstPage.body.items.map(
        (f: { id: string }) => f.id,
      );
      const secondPageIds = secondPage.body.items.map(
        (f: { id: string }) => f.id,
      );
      expect(
        secondPageIds.every((id: string) => !firstPageIds.includes(id)),
      ).toBe(true);
    });

    it('filters by title with the search query param', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Customer feedback survey' })
        .expect(201);
      await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Event registration' })
        .expect(201);

      const response = await request(server())
        .get('/api/forms?search=feedback')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].title).toBe('Customer feedback survey');
      expect(response.body.total).toBe(1);
    });
  });

  describe('GET /api/forms/:id', () => {
    it('should return the form for its owner', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      const response = await request(server())
        .get(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(created.body.id);
    });

    it('should return 403 for a non-owner', async () => {
      const { authResponse: owner } = await createAuthenticatedUser(server());
      const ownerToken = owner.user.accessToken;
      const { authResponse: other } = await createAuthenticatedUser(server());
      const otherToken = other.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      await request(server())
        .get(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 404 for a non-existent form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .get('/api/forms/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for a malformed id', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      await request(server())
        .get('/api/forms/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/forms/:id', () => {
    it('should update title, description, fields and settings', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      const field = {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'text',
        label: 'Your name',
        required: true,
      };

      const response = await request(server())
        .patch(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated survey',
          description: 'A short description',
          fields: [field],
          settings: { allowMultipleResponses: true },
        })
        .expect(200);

      expect(response.body.title).toBe('Updated survey');
      expect(response.body.description).toBe('A short description');
      expect(response.body.fields).toEqual([field]);
      expect(response.body.settings).toMatchObject({
        allowMultipleResponses: true,
      });
    });

    it('should reject an invalid field structure', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      await request(server())
        .patch(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          fields: [{ id: 'not-a-uuid', type: 'bogus-type', required: 'yes' }],
        })
        .expect(400);
    });

    it('should reject more than 50 fields', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      const fields = Array.from({ length: 51 }, (_, i) => ({
        id: `11111111-1111-4111-8111-1111111111${String(i).padStart(2, '0')}`,
        type: 'text',
        label: `Field ${i}`,
        required: false,
      }));

      await request(server())
        .patch(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ fields })
        .expect(400);
    });

    it('should return 403 when a non-owner tries to update', async () => {
      const { authResponse: owner } = await createAuthenticatedUser(server());
      const ownerToken = owner.user.accessToken;
      const { authResponse: other } = await createAuthenticatedUser(server());
      const otherToken = other.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      await request(server())
        .patch(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Hijacked' })
        .expect(403);
    });
  });

  describe('DELETE /api/forms/:id', () => {
    it('should delete the form for its owner', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      await request(server())
        .delete(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(server())
        .get(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 when a non-owner tries to delete', async () => {
      const { authResponse: owner } = await createAuthenticatedUser(server());
      const ownerToken = owner.user.accessToken;
      const { authResponse: other } = await createAuthenticatedUser(server());
      const otherToken = other.user.accessToken;

      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'My survey' })
        .expect(201);

      await request(server())
        .delete(`/api/forms/${created.body.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});
