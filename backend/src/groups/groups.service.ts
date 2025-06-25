import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateGroupDto } from './dto';
import { AuditLogService } from 'src/audit/audit-log.service';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createGroup(
    adminId: string,
    name: string,
    description: string,
    req?: any,
  ) {
    // const inviteCode = Math.random()
    //   .toString(36)
    //   .substring(2, 10)
    //   .toUpperCase();

    // return this.prisma.group.create({
    //   data: {
    //     name,
    //     description,
    //     adminId,
    //     inviteCode,
    //     members: {
    //       create: {
    //         userId: adminId,
    //       },
    //     },
    //   },
    //   include: {
    //     members: true,
    //   },
    // });

    const group = await this.prisma.group.create({
      data: {
        name,
        description,
        adminId,
        inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
        members: { create: { userId: adminId } },
      },
      include: {
        members: true,
      },
    });

    await this.auditLogService.log(
      adminId,
      'create_group',
      `Created group "${name}" (${group.id})`,
      req?.ip,
    );

    return group;
  }

  async joinGroup(userId: string, inviteCode: string, req?: any) {
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

    // audit log
    await this.auditLogService.log(
      userId,
      'join_group',
      `Joined group "${group.name}" (${group.id})`,
      req?.ip,
    );

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
  async updateGroup(
    groupId: string,
    adminId: string,
    dto: UpdateGroupDto,
    req?: any,
  ) {
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

    // audit log
    await this.auditLogService.log(
      adminId,
      'update_group',
      `Updated group "${group.name}" (${groupId})`,
      req?.ip,
    );

    return this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: dto,
    });
  }

  // add member
  async addMember(groupId: string, adminId: string, userId: string, req?: any) {
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

    // audit log
    await this.auditLogService.log(
      adminId,
      'add_member',
      `Added user ${userId} to group "${group.name}" (${groupId})`,
      req?.ip,
    );

    return this.prisma.groupMembers.create({
      data: {
        userId,
        groupId,
      },
    });
  }

  // remove member
  async removeMember(
    groupId: string,
    adminId: string,
    userId: string,
    req?: any,
  ) {
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

    // audit log
    await this.auditLogService.log(
      adminId,
      'remove_member',
      `Removed user ${userId} from group "${group.name}" (${groupId})`,
      req?.ip,
    );

    return this.prisma.groupMembers.delete({
      where: {
        id: membership.id,
      },
    });
  }

  // 
  async assignAdmin(
    groupId: string,
    currentAdminId: string,
    newAdminId: string,
    req?: any,
  ) {
    const group = await this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: {
        adminId: newAdminId,
      },
    });

    await this.auditLogService.log(
      currentAdminId,
      'assign_admin',
      `Assigned admin rights to user ${newAdminId} in group "${group.name}"(${groupId})`,
      req?.ip,
    );

    return group;
  }

  async removeAdmin(
    groupId: string,
    adminId: string,
    removedAdminId: string,
    req?: any,
  ) {
    // Your logic for removing admin rights (e.g., set adminId to null or another user)
    // Example: await this.prisma.group.update({ where: { id: groupId }, data: { adminId: null } });

    await this.auditLogService.log(
      adminId,
      'remove_admin',
      `Removed admin rights from user ${removedAdminId} in group ${groupId}`,
      req?.ip,
    );
    // Return something if needed
  }
}
