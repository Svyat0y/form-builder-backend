import { Module } from '@nestjs/common';
import { AppController } from '../src/app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from '../src/app.service';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../src/users/users.module';
import { AuthModule } from '../src/auth/auth.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5433,
      username: 'postgres',
      password: 'password',
      database: 'form_builder_test',
      retryAttempts: 5,
      retryDelay: 3000,
      autoLoadEntities: true,
      synchronize: true,
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppTestModule {}
