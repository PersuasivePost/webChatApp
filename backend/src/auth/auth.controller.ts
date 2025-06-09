import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtGuard } from './guards/jwt.guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const emailOrUsername = dto.email || dto.username;
    if (!emailOrUsername) {
      throw new Error('Email or username must be provided');
    }
    return await this.authService.login(emailOrUsername, dto.password);
  }

  //
  @Post('verify-email')
  async verifyEmail(
    @Body()
    body: {
      email: string;
      code: string;
      password: string;
      username: string;
      firstName: string;
      lastName: string;
    },
  ) {
    return await this.authService.verifyEmail(
      body.email,
      body.code,
      body.password,
      body.username,
      body.firstName,
      body.lastName,
    );
  }

  @UseGuards(JwtGuard)
  @Get('me')
  getProfile(@Request() req) {
    return { message: 'Authenticated', user: req.user };
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: { email: string; code: string; newPassword: string },
  ) {
    return this.authService.resetPassword(
      body.email,
      body.code,
      body.newPassword,
    );
  }
}
