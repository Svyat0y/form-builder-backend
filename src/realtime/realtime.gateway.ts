import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Namespace, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../tokens/token.service';

// Same allowlist as REST (see src/config/cors.config.ts), read directly from
// env since @WebSocketGateway options are evaluated at class-decoration time,
// before Nest DI is available.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

interface JwtPayload {
  userId: string;
  email: string;
}

// See docs/forms-realtime-architecture.md §7 — auth on handshake mirrors
// JwtStrategy: verify signature/expiry, then confirm the token is still
// valid (not revoked) in the DB. Sockets join `user:<userId>` and never
// broadcast; every push is addressed to that room.
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Typed as Namespace, not Server: @WebSocketGateway({ namespace: ... })
  // makes Nest inject the /realtime namespace instance at runtime, and only
  // Namespace exposes .adapter/.sockets as the room/socket maps we need
  // below (Server.adapter is a different, unrelated overload).
  @WebSocketServer()
  server: Namespace;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        throw new Error('No token in handshake.auth');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const tokenInDb = await this.tokenService.findValidAccessToken(token);
      if (!tokenInDb) {
        throw new Error('Token revoked or expired');
      }

      client.data.userId = payload.userId;
      client.data.tokenId = tokenInDb.id;

      await client.join(`user:${payload.userId}`);
      this.logger.debug(`Socket connected: user ${payload.userId}`);
    } catch (error) {
      this.logger.warn(`Socket auth failed: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    if (client.data?.userId) {
      this.logger.debug(`Socket disconnected: user ${client.data.userId}`);
    }
  }

  // ResponsesService emits this after the submit transaction commits — see
  // §6/§7 of the design doc. WS is an acceleration, not the source of truth.
  @OnEvent('form.response.created')
  handleResponseCreated(payload: {
    formId: string;
    ownerId: string;
    responsesCount: number;
    responseId: string;
    createdAt: Date;
  }): void {
    this.server.to(`user:${payload.ownerId}`).emit('response:new', {
      formId: payload.formId,
      responsesCount: payload.responsesCount,
      responseId: payload.responseId,
      createdAt: payload.createdAt,
    });
  }

  // TokenService emits this from every revoke path (logout, session revoke,
  // global revoke). A revoked session must not keep a live socket — see §7.
  @OnEvent('token.revoked')
  handleTokenRevoked(payload: { tokenId: string; userId: string }): void {
    // `this.server` is already scoped to the /realtime namespace (declared
    // via @WebSocketGateway({ namespace: '/realtime' })), so `.adapter` and
    // `.sockets` here refer to that namespace directly — no `.of()` needed
    // (and Namespace instances don't expose that method).
    const room = this.server.adapter.rooms.get(`user:${payload.userId}`);
    if (!room) return;

    for (const socketId of room) {
      const socket = this.server.sockets.get(socketId);
      if (socket?.data.tokenId === payload.tokenId) {
        socket.disconnect(true);
      }
    }
  }
}
