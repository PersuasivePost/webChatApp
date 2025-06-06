import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(adminId: string, name: string, description: string) {
    const inviteCode = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    return this.prisma.group.create({
      data: {
        name,
        description,
        adminId,
        inviteCode,
        members: {
          create: {
            userId: adminId,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  async joinGroup(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isAlreadyMember = group.members.some(
      (member) => member.userId === userId,
    );
    if (isAlreadyMember) {
      throw new ConflictException('Already a member of this group');
    }

    await this.prisma.groupMembers.create({
      data: {
        userId,
        groupId: group.id,
      },
    });

    return {
      message: 'Successfully joined group',
    };
  }
}
