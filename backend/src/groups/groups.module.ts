import { PrismaService } from 'src/prisma/prisma.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from 'src/audit/audit.module';
import { AuthModule } from 'src/auth';

@Module({
  imports: [AuditModule, forwardRef(() => AuthModule)],
  controllers: [GroupsController],
  providers: [GroupsService, PrismaService],
})
export class GroupsModule {}
