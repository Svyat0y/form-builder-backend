import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createUser(
    email: string,
    name: string,
    password: string,
  ): Promise<User> {
    const user = new User();
    user.email = email;
    user.name = name;
    user.password = password;

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.usersRepository.remove(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.usersRepository.update(userId, { refreshToken });
  }

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { refreshToken },
    });
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { refreshToken: null });
  }
}
