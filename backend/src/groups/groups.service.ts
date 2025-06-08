import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateGroupDto } from './dto';

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

  //
  async getGroupMembers(groupId: string) {
    return this.prisma.groupMembers.findMany({
      where: { groupId },
      include: { user: true },
    });
  }

  // update group
  async updateGroup(groupId: string, adminId: string, dto: UpdateGroupDto) {
    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException('Only the group admin can update the group');
    }

    return this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: dto,
    });
  }

  // add member
  async addMember(groupId: string, adminId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException(
        'Only the group admin can add group members',
      );
    }

    const existingMember = await this.prisma.groupMembers.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (existingMember) {
      throw new ForbiddenException('User is already a member of this group');
    }

    return this.prisma.groupMembers.create({
      data: {
        userId,
        groupId,
      },
    });
  }

  // remove member
  async removeMember(groupId: string, adminId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: {
        id: groupId,
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.adminId !== adminId) {
      throw new ForbiddenException(
        'Only the group admin can add group members',
      );
    }

    if (userId === adminId) {
      throw new ForbiddenException('Cannot remove the group admin');
    }

    const membership = await this.prisma.groupMembers.findFirst({
      where: {
        groupId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this group');
    }

    return this.prisma.groupMembers.delete({
      where: {
        id: membership.id,
      },
    });
  }
}
