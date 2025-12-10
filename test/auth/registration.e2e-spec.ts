import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppTestModule } from '../app-test.module';

describe('Auth - Registration (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Set environment to dev (testing uses test database via AppTestModule)
    process.env.NODE_ENV = 'dev';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule], // Uses test database configuration
    }).compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    await app.init();
  });

  beforeEach(async () => {
    // Clear all tables before each test
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.clear();
    }
  });

  afterAll(async () => {
    // Cleanup after all tests
    await app.close();
    if (dataSource.isInitialized) {
      // await dataSource.dropDatabase();
      await dataSource.destroy();
    }
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toEqual({
        message: 'User registered successfully',
        user: {
          id: expect.any(String),
          email: userData.email,
          name: userData.name,
          createdAt: expect.any(String),
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Validate UUID format
      expect(response.body.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should return 409 when email already exists', async () => {
      const userData = {
        email: 'duplicate@example.com',
        name: 'First User',
        password: 'Password123',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      // Attempt duplicate registration
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...userData,
          name: 'Second User',
          password: 'Password456',
        })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'User with this email already exists',
        error: 'Conflict',
      });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          name: 'Test User',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].field).toBe('email');
    });

    it('should return 400 for password that is too short', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          password: 'Ab1',
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe('password');
    });

    it('should return 400 for name with invalid characters', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test123',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.errors[0].field).toBe('name');
    });
  });
});
