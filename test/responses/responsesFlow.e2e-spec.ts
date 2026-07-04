import request from 'supertest';
import { getTestFixture, createAuthenticatedUser } from '../setup/jest-setup';

describe('Responses - public/submit/list/stats (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  beforeAll(async () => {
    await fixture.clearDatabase();
  });

  const RADIO_FIELD = {
    id: '7b6c3f60-1111-4222-8333-444455556666',
    type: 'radio',
    label: 'Favorite color',
    required: true,
    options: ['Red', 'Blue'],
    trackStats: true,
  };

  const TEXT_FIELD = {
    id: '7b6c3f60-2222-4222-8333-444455556666',
    type: 'text',
    label: 'Comment',
    required: false,
  };

  async function createActiveForm(accessToken: string) {
    const created = await request(server())
      .post('/api/forms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Survey' })
      .expect(201);
    const form = created.body as { id: string };

    await request(server())
      .patch(`/api/forms/${form.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fields: [RADIO_FIELD, TEXT_FIELD] })
      .expect(200);

    await request(server())
      .post(`/api/forms/${form.id}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    return form.id;
  }

  describe('GET /api/forms/:id/public', () => {
    it('returns the form fields without owner info for an ACTIVE form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const formId = await createActiveForm(authResponse.user.accessToken);

      const response = await request(server())
        .get(`/api/forms/${formId}/public`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: formId,
        title: 'Survey',
      });
      expect(response.body.fields).toHaveLength(2);
      expect(response.body.ownerId).toBeUndefined();
    });

    it('returns 404 for a DRAFT form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${authResponse.user.accessToken}`)
        .send({ title: 'Draft survey' })
        .expect(201);

      await request(server())
        .get(`/api/forms/${(created.body as { id: string }).id}/public`)
        .expect(404);
    });
  });

  describe('POST /api/forms/:id/submit', () => {
    it('accepts a valid submission and increments responsesCount', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const formId = await createActiveForm(authResponse.user.accessToken);

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Red' } })
        .expect(201);

      const form = await request(server())
        .get(`/api/forms/${formId}`)
        .set('Authorization', `Bearer ${authResponse.user.accessToken}`)
        .expect(200);

      expect(form.body.responsesCount).toBe(1);
    });

    it('rejects a submission missing a required field', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const formId = await createActiveForm(authResponse.user.accessToken);

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: {} })
        .expect(400);
    });

    it('rejects a radio answer outside the declared options', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const formId = await createActiveForm(authResponse.user.accessToken);

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Green' } })
        .expect(400);
    });

    it('returns 404 when submitting to a non-ACTIVE form', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const created = await request(server())
        .post('/api/forms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Draft survey' })
        .expect(201);
      const formId = (created.body as { id: string }).id;

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: {} })
        .expect(404);
    });
  });

  describe('GET /api/forms/:id/responses', () => {
    it('lists responses to the owner, newest first', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const formId = await createActiveForm(accessToken);

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Red' } })
        .expect(201);
      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Blue' } })
        .expect(201);

      const response = await request(server())
        .get(`/api/forms/${formId}/responses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.total).toBe(2);
      expect(response.body.items).toHaveLength(2);
    });

    it('returns 403 for a non-owner', async () => {
      const owner = await createAuthenticatedUser(server());
      const formId = await createActiveForm(
        owner.authResponse.user.accessToken,
      );

      const other = await createAuthenticatedUser(server());

      await request(server())
        .get(`/api/forms/${formId}/responses`)
        .set('Authorization', `Bearer ${other.authResponse.user.accessToken}`)
        .expect(403);
    });
  });

  describe('GET /api/forms/:id/responses/stats', () => {
    it('aggregates distribution for trackStats fields and latest for text', async () => {
      const { authResponse } = await createAuthenticatedUser(server());
      const accessToken = authResponse.user.accessToken;
      const formId = await createActiveForm(accessToken);

      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({
          answers: { [RADIO_FIELD.id]: 'Red', [TEXT_FIELD.id]: 'Great form' },
        })
        .expect(201);
      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Red' } })
        .expect(201);
      await request(server())
        .post(`/api/forms/${formId}/submit`)
        .send({ answers: { [RADIO_FIELD.id]: 'Blue' } })
        .expect(201);

      const response = await request(server())
        .get(`/api/forms/${formId}/responses/stats`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.total).toBe(3);

      const radioStats = response.body.fields.find(
        (f: { fieldId: string }) => f.fieldId === RADIO_FIELD.id,
      );
      expect(radioStats.distribution).toEqual({ Red: 2, Blue: 1 });

      const textStats = response.body.fields.find(
        (f: { fieldId: string }) => f.fieldId === TEXT_FIELD.id,
      );
      expect(textStats.latest).toEqual(['Great form']);
    });
  });
});
