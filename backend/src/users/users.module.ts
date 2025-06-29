import { forwardRef, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsersController } from './users.controller';
import { MailModule } from 'src/mail/mail.module';
import { AuditModule } from 'src/audit/audit.module';
import { AuthModule } from 'src/auth';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MailModule),
    forwardRef(() => AuthModule),
    AuditModule,
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
