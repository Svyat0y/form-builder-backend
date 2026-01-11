import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { createCorsConfig } from './config/cors.config';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LogLevel } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { UnifiedExceptionFilter } from './common/filters/unified-exception.filter';

async function bootstrap() {
  const logLevels: LogLevel[] =
    process.env.NODE_ENV === 'production'
      ? ['error']
      : ['debug', 'log', 'warn', 'error'];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors(createCorsConfig(configService));
  app.useGlobalFilters(new UnifiedExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Form Builder API')
    .setDescription('The Form Builder API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Form Builder API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(3001);
}
bootstrap();
