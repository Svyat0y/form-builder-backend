import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

let app: INestApplication;
let dataSource: DataSource;

export async function setupTestApp() {
  if (app) return { app, dataSource };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  dataSource = moduleRef.get<DataSource>(DataSource);

  await app.init();

  return { app, dataSource };
}

export async function cleanupTestApp() {
  if (app) {
    await app.close();
  }
}

export async function clearDatabase() {
  if (!dataSource) return;

  const entities = dataSource.entityMetadatas;
  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.clear();
  }
}
