import request from 'supertest';
import { getTestFixture } from './setup/jest-setup';

describe('AppController (e2e)', () => {
  let fixture: Awaited<ReturnType<typeof getTestFixture>>;

  beforeAll(async () => {
    fixture = await getTestFixture();
  });

  it('/ (GET)', async () => {
    const response = await request(fixture.getHttpServer())
      .get('/')
      .expect(200);

    expect(response.text).toBe('Hello World!');
  });
});
