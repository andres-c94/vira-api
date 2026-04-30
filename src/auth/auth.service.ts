import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveTimezone } from '../program-sync/program-sync.utils';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string; user: Omit<User, 'passwordHash' | 'createdAt' | 'updatedAt'> }> {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        timezone: resolveTimezone(dto.timezone)
      }
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; user: Omit<User, 'passwordHash' | 'createdAt' | 'updatedAt'> }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }

  private buildAuthResponse(user: User): { accessToken: string; user: Omit<User, 'passwordHash' | 'createdAt' | 'updatedAt'> } {
    const {
      passwordHash,
      createdAt,
      updatedAt,
      ...safeUser
    } = user;

    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: safeUser
    };
  }
}
