import { forwardRef, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from 'src/auth';

@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule)],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
