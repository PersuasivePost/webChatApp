import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto';
import * as argon2 from 'argon2';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const existingUser = await this.usersService.findByEmailOrUsername(
      data.email,
      data.username,
    );

    if (existingUser) {
      throw new ConflictException('Email or username already in use');
    }

    const hashedPassword = await argon2.hash(data.password);

    const user = await this.usersService.createUser({
      ...data,
      password: hashedPassword,
    });

    const accessToken = this.signToken(user.id, user.email, user.username);

    const { password, ...safeUser } = user;

    return {
      access_token: accessToken,
      user: safeUser,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.signToken(user.id, user.email, user.username);

    const { password: _, ...safeUser } = user;

    return {
      access_token: accessToken,
      user: safeUser,
    };
  }

  private signToken(userId: string, email: string, username: string) {
    const payload = {
      sub: userId,
      email,
      username,
    };

    return this.jwtService.sign(payload);
  }
}
