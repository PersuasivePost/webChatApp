import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from 'src/auth';
import { MailService } from './mail.service';

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  @Post('send-verification-email')
  async sendVerificationEmail(@Body() body: { email: string }) {
    const verificationCode = Math.floor(Math.random() * 900000) + 100000; // 6 digit code
    await this.mailService.sendVerificationEmail(
      body.email,
      verificationCode.toString(),
    );
    return { message: 'Verification email sent successfully.' };
  }

  @Post('send-test-email')
  async sendTestEmail(@Body() body: { email: string }) {
    await this.mailService.sendFriendRequestNotification(
      body.email,
      'Test User',
    );
    return { message: 'Test email sent successfully.' };
  }
}
