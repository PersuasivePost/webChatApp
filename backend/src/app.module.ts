import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
//import { CsrfTokenController } from 'src/csrf-token.controller';
import { MailModule } from './mail/mail.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    GroupsModule,
    MailModule,
    ChatModule,
  ],
  //controllers: [CsrfTokenController],
  controllers: [],
  providers: [],
})
export class AppModule {}
