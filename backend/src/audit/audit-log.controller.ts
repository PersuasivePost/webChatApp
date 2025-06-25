import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getLogs(@Query('userId') userId?: string) {
    return this.auditLogService.getLogs(userId);
  }
}
