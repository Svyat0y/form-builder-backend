import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  private isValidUUID(id: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  private validateUUID(id: string): void {
    if (!this.isValidUUID(id)) {
      this.logger.warn(`INVALID_UUID: ${id}`);
      throw new BadRequestException(`Invalid user ID format: ${id}`);
    }
  }

  async createUser(
    email: string,
    name: string,
    password?: string,
  ): Promise<User> {
    const user = new User();
    user.email = email;
    user.name = name;
    user.password = password;
    user.role = UserRole.USER;

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async findByFacebookId(facebookId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { facebookId } });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, updates);
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async deleteUser(id: string, requestingUserId: string): Promise<void> {
    this.validateUUID(id);
    this.validateUUID(requestingUserId);

    const requestingUser = await this.findById(requestingUserId);
    if (!requestingUser) {
      this.logger.warn(
        `USER_DELETE_DENIED: Requesting user not found - ${requestingUserId}`,
      );
      throw new NotFoundException(
        `Requesting user with ID ${requestingUserId} not found`,
      );
    }

    const user = await this.findById(id);
    if (!user) {
      this.logger.warn(`USER_DELETE_FAILED: User not found - ${id}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const reqRole = (requestingUser as any).role;
    const targetRole = (user as any).role;

    // Authorization rules:
    // - USER: can delete only themselves
    // - ADMIN: can delete only regular users (not ADMIN, not SUPER_ADMIN)
    // - SUPER_ADMIN: can delete anyone
    if (reqRole === UserRole.USER) {
      if (id !== requestingUserId) {
        this.logger.warn(
          `USER_DELETE_DENIED: User ${requestingUserId} tried to delete another user ${id}`,
        );
        throw new ForbiddenException('You can only delete your own account');
      }
    } else if (reqRole === UserRole.ADMIN) {
      if (targetRole !== UserRole.USER) {
        this.logger.warn(
          `USER_DELETE_DENIED: Admin ${requestingUserId} tried to delete ${targetRole} user ${id}`,
        );
        throw new ForbiddenException('Admins can only delete regular users');
      }
    }

    this.logger.log(
      `USER_DELETED: User ${id} (${targetRole}) deleted by ${requestingUserId} (${reqRole})`,
    );
    await this.usersRepository.delete(id);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async updateUserRole(
    targetUserId: string,
    requestingUserId: string,
    newRole: UserRole,
  ): Promise<User> {
    this.validateUUID(targetUserId);

    if (targetUserId === requestingUserId) {
      this.logger.warn(
        `ROLE_CHANGE_DENIED: User ${requestingUserId} tried to change own role`,
      );
      throw new BadRequestException('You cannot change your own role');
    }

    const user = await this.findById(targetUserId);
    if (!user) {
      this.logger.warn(`ROLE_UPDATE_FAILED: User not found - ${targetUserId}`);
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    if ((user as any).role === UserRole.SUPER_ADMIN) {
      this.logger.warn(
        `ROLE_CHANGE_DENIED: User ${requestingUserId} tried to change SUPER_ADMIN role`,
      );
      throw new BadRequestException(
        'Cannot change SUPER_ADMIN role. Only database modification allowed.',
      );
    }

    const oldRole = (user as any).role;
    (user as any).role = newRole;

    const updatedUser = await this.usersRepository.save(user);

    this.logger.log(
      `USER_ROLE_UPDATED: User ${targetUserId} role changed from ${oldRole} to ${newRole} by ${requestingUserId}`,
    );

    return updatedUser;
  }
}
