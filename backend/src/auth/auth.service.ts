import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from 'src/mail/mail.service';
import { RegisterDto } from './dto';
import * as argon2 from 'argon2';
import { PrismaService } from 'src/mail/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private mailService: MailService,
  ) {}

  async register(data: RegisterDto) {
    const existingUser = await this.usersService.findByEmailOrUsername(
      data.email,
      data.username,
    );

    if (existingUser) {
      throw new ConflictException('Email or username already in use');
    }

    await this.prismaService.verificationCode.deleteMany({
      where: { email: data.email },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    await this.prismaService.verificationCode.create({
      data: {
        userId: null,
        email: data.email,
        code,
        expiresAt,
      },
    });

    await this.mailService.sendVerificationEmail(data.email, code);

    return { message: 'Verification code sent to your email' };

    // const hashedPassword = await argon2.hash(data.password);

    // create user with isEmailVerified: false
    // const user = await this.usersService.createUser({
    //   ...data,
    //   password: hashedPassword,
    //   isEmailVerified: false,
    // });

    // // nodemailer logic:
    // const code = Math.floor(100000 + Math.random() * 900000).toString();
    // const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    // await this.prismaService.verificationCode.create({
    //   data: {
    //     userId: user.id,
    //     code,
    //     expiresAt,
    //   },
    // });

    // send verification email
    // await this.mailService.sendVerificationEmail(user.email, code);

    // return { message: 'Verification code sent to your email' };

    // end of nodemailer logic

    // const accessToken = this.signToken(user.id, user.email, user.username);

    // const { password, ...safeUser } = user;

    // return {
    //   access_token: accessToken,
    //   user: safeUser,
    // };
  }

  async verifyEmail(
    email: string,
    code: string,
    password: string,
    username: string,
    firstName: string,
    lastName: string,
  ) {
    // check if user already exists (means already verified)
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already verified and user exists'); // add this
    }

    //
    const record = await this.prismaService.verificationCode.findFirst({
      where: {
        email,
        code,
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid verification code');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Verification code expired');
    }

    const hashedPassword = await argon2.hash(password);

    const user = await this.usersService.createUser({
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      isEmailVerified: true,
    });

    //
    await this.prismaService.verificationCode.updateMany({
      where: { email },
      data: { userId: user.id },
    });

    await this.prismaService.verificationCode.delete({
      where: {
        id: record.id,
      },
    });

    return { message: 'Email verified and user account created successfully' };
  }

  async login(emailOrUsername: string, password: string) {
    const user =
      (await this.usersService.findByEmail(emailOrUsername)) ||
      (await this.usersService.findByUsername?.(emailOrUsername)) ||
      (await this.usersService.findByEmailOrUsername(
        emailOrUsername,
        emailOrUsername,
      ));

    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    // nodemaliler logic:
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const accessToken = this.signToken(user.id, user.email, user.username);

    const { password: _, ...safeUser } = user;

    return {
      access_token: accessToken,
      user: safeUser,
    };
  }

  // async verifyEmail(email: string, code: string) {
  //   const user = await this.usersService.findByEmail(email);
  //   if (!user) {
  //     throw new NotFoundException('User not found');
  //   }

  //   const record = await this.prismaService.verificationCode.findFirst({
  //     where: {
  //       userId: user.id,
  //       code,
  //     },
  //   });

  //   if (!record) {
  //     throw new UnauthorizedException('Invalid verification code');
  //   }

  //   if (record.expiresAt < new Date()) {
  //     throw new UnauthorizedException('Verification code expired');
  //   }

  //   await this.prismaService.user.update({
  //     where: {
  //       id: user.id,
  //     },
  //     data: {
  //       isEmailVerified: true,
  //     },
  //   });

  //   await this.prismaService.verificationCode.delete({
  //     where: {
  //       id: record.id,
  //     },
  //   });

  //   return { message: 'Email verified successfully' };
  // }

  // Request password reset
  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry

    await this.prismaService.verificationCode.create({
      data: {
        userId: user.id,
        email: user.email,
        code,
        expiresAt,
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, code);

    return { message: 'Password reset code sent to your email' };
  }

  // Reset Password
  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const record = await this.prismaService.verificationCode.findFirst({
      where: {
        userId: user.id,
        code,
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid code');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException(' Reset code expired');
    }

    const hashed = await argon2.hash(newPassword);
    await this.prismaService.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: hashed,
      },
    });

    await this.prismaService.verificationCode.delete({
      where: {
        id: record.id,
      },
    });

    return { message: 'Password reset successful' };
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
