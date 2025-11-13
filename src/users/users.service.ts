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

  // create user
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

  // find user by email
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  // find user by id
  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  // delete user by id
  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.usersRepository.remove(user);
  }

  // get all users
  async findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}
