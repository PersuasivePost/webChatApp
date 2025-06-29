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
import { PrismaService } from 'src/prisma/prisma.service';
import { Profile } from 'passport-google-oauth20';
import { randomBytes } from 'crypto';
import { addDays } from 'date-fns';
import { AuditLogService } from 'src/audit/audit-log.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prismaService: PrismaService,
    private mailService: MailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(data: RegisterDto, req?: any) {
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

    // audit log
    await this.auditLogService.log(
      null,
      'register',
      `Registration attempt for ${data.email}`,
      req?.ip,
    );

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
    userId: string,
    req?: any,
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

    // audit log
    await this.auditLogService.log(
      userId,
      'verify_email',
      'Email verified',
      req?.ip,
    );

    return { message: 'Email verified and user account created successfully' };
  }

  async login(emailOrUsername: string, password: string, req?: any) {
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
    const refreshToken = await this.generateRefreshToken(user.id);

    const { password: _, ...safeUser } = user;

    // audit log
    await this.auditLogService.log(user.id, 'login', 'User logged in', req?.ip);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
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
  async requestPasswordReset(email: string, req?: any) {
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

    // audit log
    await this.auditLogService.log(
      null,
      'request_password_reset',
      `Requested for ${email}`,
      req?.ip,
    );

    return { message: 'Password reset code sent to your email' };
  }

  // Reset Password
  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
    userId: string,
    req?: any,
  ) {
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

    await this.auditLogService.log(
      userId,
      'reset_password',
      'Password reset',
      req?.ip,
    );

    return { message: 'Password reset successful' };
  }

  // OAuth2 logic
  async validateGoogleUser(profile: Profile) {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new UnauthorizedException('Google account does not have an email');
    }

    const username = profile.displayName || email.split('@')[0] || 'googleuser';
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      user = await this.usersService.createUser({
        email,
        username,
        password: '', // not used for google users
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        isEmailVerified: true,
      });
    }

    return user;
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = addDays(new Date(), 7);

    await this.prismaService.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  // oauthlogin auditlog copilot added 
  async oauthLogin(userId: string, req?: any) {
    await this.auditLogService.log(
      userId,
      'oauth_login',
      'User logged in via OAuth',
      req?.ip,
    );

    // rest of logic if needed
  }

  public async revokeRefreshToken(token: string) {
    await this.prismaService.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  }

  async refreshTokens(refreshToken: string) {
    const stored = await this.prismaService.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (
      !stored ||
      stored.revoked ||
      stored.expiresAt < new Date() ||
      !stored.user
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // rotate: revoke old, issue new
    await this.revokeRefreshToken(refreshToken);
    const newRefreshToken = await this.generateRefreshToken(stored.userId);

    const accessToken = this.signToken(
      stored.user.id,
      stored.user.email,
      stored.user.username,
    );

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      user: {
        id: stored.user.id,
        username: stored.user.username,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
      },
    };
  }

  // logout logic
  async logout(userId: string, req?: any) {
    await this.auditLogService.log(
      userId,
      'logout',
      'User logged out',
      req?.ip,
    );
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
