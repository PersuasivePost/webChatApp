import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

@Module({
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditModule {}
