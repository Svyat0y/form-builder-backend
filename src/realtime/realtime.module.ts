import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TokensModule } from '../tokens/tokens.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, TokensModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
