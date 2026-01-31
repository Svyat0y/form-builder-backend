import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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
    password: string,
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

  async deleteUser(id: string): Promise<void> {
    this.validateUUID(id);

    this.logger.log(`USER_DELETED: ${id}`);

    const user = await this.findById(id);

    if (!user) {
      this.logger.warn(`USER_DELETE_FAILED: User not found - ${id}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.usersRepository.delete(id);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}
