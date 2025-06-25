import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
//import { CsrfTokenController } from 'src/csrf-token.controller';
import { MailModule } from './mail/mail.module';
import { ChatModule } from './chat/chat.module';
import { AuditModule } from './audit/audit.module';
//import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    GroupsModule,
    MailModule,
    ChatModule,
    // ThrottlerModule.forRoot({
    //   ttl: 60,
    //   limit: 10,
    // }),
    AuditModule
  ],
  //controllers: [CsrfTokenController],
  controllers: [],
  providers: [],
})
export class AppModule {}
