import request from 'supertest';
import { getTestFixture } from './setup/jest-setup';

describe('AppController (e2e)', () => {
  const fixture = getTestFixture();
  const server = () => fixture.getHttpServer();

  it('/ (GET)', async () => {
    const response = await request(server()).get('/').expect(200);

    expect(response.text).toBe('Hello World!');
  });
});
