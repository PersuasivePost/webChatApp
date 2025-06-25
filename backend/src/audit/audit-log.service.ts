import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prismaService: PrismaService) {}

  async log(
    userId: string | null,
    action: string,
    details?: string,
    ip?: string,
  ) {
    await this.prismaService.auditLog.create({
      data: {
        userId,
        action,
        details,
        ip,
      },
    });
  }

  async getLogs(userId?: string) {
    return this.prismaService.auditLog.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to the most recent 100 logs
    });
  }
}
