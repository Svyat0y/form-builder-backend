import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const req = context.switchToHttp().getRequest();
    const jwtUser = req.user as { userId?: string } | undefined;

    if (!jwtUser?.userId) {
      throw new ForbiddenException('User not authenticated');
    }

    const user = await this.usersService.findById(jwtUser.userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (requiredRoles.includes((user as any).role)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
