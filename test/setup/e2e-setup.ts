import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppTestModule } from '../app-test.module';
import { Server } from 'http';
import { UnifiedExceptionFilter } from '../../src/common/filters/unified-exception.filter';
import { validationPipeConfig } from '../../src/config/validation.config';
import cookieParser from 'cookie-parser';

/**
 * E2E Test Fixture - manages test application lifecycle
 *
 * Best Practices:
 * - Single instance created for all tests (via global-setup.ts)
 * - Database cleanup controlled per test suite
 * - Provides HTTP server access for requests
 */
export class E2ETestFixture {
  public app: INestApplication;
  public dataSource: DataSource;
  private moduleFixture: TestingModule;

  /**
   * Initialize test application
   * Called once in global setup
   */
  async setup(): Promise<void> {
    console.log('🛠️  Setting up test environment...');

    this.moduleFixture = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();
    this.dataSource = this.moduleFixture.get<DataSource>(DataSource);

    this.app.use(cookieParser());

    this.app.useGlobalFilters(new UnifiedExceptionFilter());
    this.app.useGlobalPipes(validationPipeConfig);

    await this.app.init();

    console.log('✅ Test environment ready');
  }

  /**
   * Clear all data from database
   * Use strategically - not necessarily after every test
   */
  async clearDatabase(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;

    for (const entity of entities) {
      const tableName = entity.tableName;
      try {
        await this.dataSource.query(
          `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`,
        );
      } catch (error) {
        console.warn(
          `Warning: Could not truncate ${tableName}:`,
          error.message,
        );
      }
    }

    console.log('🧹 Database cleared');
  }

  /**
   * Get HTTP server for making requests
   */
  getHttpServer(): Server {
    return this.app.getHttpServer() as unknown as Server;
  }
}
