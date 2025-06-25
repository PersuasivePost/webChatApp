import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
  Get,
  Req,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtGuard } from './guards/jwt.guards';
import { AuthGuard } from '@nestjs/passport';

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
    @Req() req,
  ) {
    return await this.authService.verifyEmail(
      body.email,
      body.code,
      body.password,
      body.username,
      body.firstName,
      body.lastName,
      req,
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
    @Req() req,
  ) {
    return this.authService.resetPassword(
      body.email,
      body.code,
      body.newPassword,
      '',
      req,
    );
  }

  // gooogle auth
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // passport will redirect to Google for authentication
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    const user = req.user;

    // audit lof
    await this.authService.oauthLogin(user.id, req);

    const accessToken = this.authService['signToken'](
      user.id,
      user.email,
      user.username,
    );

    return res.redirect(
      `http://localhost:4200/oauth-success?token=${accessToken}`,
    );
  }

  @Post('logout')
  @UseGuards(JwtGuard)
  async logout(
    @Req() req,
    @Body('refresh_token') refreshToken: string,
    @Res() res,
  ) {
    // For JWT, logout is handled on the client by deleting the token.
    // Optionally, you can implement token blacklisting here.
    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    // audit log
    await this.authService.logout(req.user.id, req);
    return res.status(200).json({ message: 'Logged out successfully' });
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }
}
