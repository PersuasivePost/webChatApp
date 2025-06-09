import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: this.configService.get<string>('MAIL_SERVICE'),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASSWORD'),
      },
    });
  }

  // send verification email
  async sendVerificationEmail(
    email: string,
    verificationCode: string,
  ): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to: email,
      subject: 'Email Verification',
      html: `
        <h1>Email Verification</h1>
        <p>Your verification code is: <strong>${verificationCode}</strong></p>
        <p>This code will expire in 24 hours.</p>
      `,
    };
    await this.transporter.sendMail(mailOptions);
  }

  // send friend request email notification
  async sendFriendRequestNotification(
    recipientEmail: string,
    senderName: string,
  ): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_FROM'),
      to: recipientEmail,
      subject: 'Friend Request Notification',
      html: `
        <h1>New Friend Request</h1>
        <p>You have received a friend request from ${senderName}.</p>
        <p>Log in to your account to accept or decline the request.</p>
        `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  // send password reset email
  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get<string>('MAIL_FORM'),
      to: email,
      subject: 'Password Reset Request',
      html: `
      <h1>Password Reset Request</h1>
      <p>You have requested a password reset. Your reset code is: <strong>${code}</strong></p>
      <p>This code will expire in 15 minutes.</p>`,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
