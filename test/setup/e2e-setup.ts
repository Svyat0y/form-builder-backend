import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppTestModule } from '../app-test.module';
import { Server } from 'http';

export class E2ETestFixture {
  public app: INestApplication;
  public dataSource: DataSource;
  private moduleFixture: TestingModule;

  async setup(): Promise<void> {
    console.log('🛠️  Setting up test environment...');

    this.moduleFixture = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();
    this.dataSource = this.moduleFixture.get<DataSource>(DataSource);

    await this.app.init();

    console.log('✅ Test environment ready');
  }

  async clearDatabase(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;

    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.clear();
    }

    console.log('🧹 Database cleared');
  }

  async teardown(): Promise<void> {
    console.log('🛑 Cleaning up test environment...');

    await this.app.close();

    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }

    console.log('✅ Test environment cleaned up');
  }

  getHttpServer(): Server {
    return this.app.getHttpServer() as unknown as Server;
  }
}
