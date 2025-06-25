import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, User } from '../../generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as argon2 from 'argon2';
import { AuditLogService } from 'src/audit/audit-log.service';
import { AnyCnameRecord } from 'dns';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // User CRUD
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    isEmailVerified?: boolean;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // Friendship CRUD
  async sendFriendRequest(
    userId: string,
    friendId: string,
    requestId: string,
    req?: any,
  ) {
    // Prevent sending request to self
    if (userId === friendId) {
      throw new ForbiddenException('Cannot send friend request to self');
    }

    // Prevent duplicate requests
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
        status: { in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED] },
      },
    });

    if (existing) {
      throw new ForbiddenException(
        'Friend request already exists or you are already friends',
      );
    }

    const friendRequest = await this.prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: FriendshipStatus.PENDING,
      },
    });

    // Nodemailer logic:
    const friend = await this.prisma.user.findUnique({
      where: { id: friendId },
    });
    const sender = await this.prisma.user.findUnique({ where: { id: userId } });
    if (friend && sender) {
      await this.mailService.sendFriendRequestNotification(
        friend.email,
        sender.username,
      );
    }

    // Audit log
    await this.auditLogService.log(
      userId,
      'send_friend_request',
      `Sent to ${friendId}`,
      req?.ip,
    );

    return friendRequest;
  }

  // Accept friend request
  async acceptFriendRequest(userId: string, requestId: string, req?: any) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.friendId !== userId)
      throw new ForbiddenException('Not authorized to accept this request');
    if (request.status !== FriendshipStatus.PENDING)
      throw new ForbiddenException('Request is not pending');

    // Audit log
    await this.auditLogService.log(
      userId,
      'accept_friend_request',
      `Accepted request from ${request.userId}`,
      req?.ip,
    );

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  // Reject friend request
  async rejectFriendRequest(userId: string, requestId: string, req?: any) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.friendId !== userId)
      throw new ForbiddenException('Not authorized to reject this request');
    if (request.status !== FriendshipStatus.PENDING)
      throw new ForbiddenException('Request is not pending');

    // Audit log
    await this.auditLogService.log(
      userId,
      'reject_friend_request',
      `Rejected request from ${request.userId}`,
      req?.ip,
    );

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.REJECTED },
    });
  }

  async getFriends(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        OR: [
          { userId, status: FriendshipStatus.ACCEPTED },
          { friendId: userId, status: FriendshipStatus.ACCEPTED },
        ],
      },
      include: {
        user: { select: { id: true, username: true } },
        friend: { select: { id: true, username: true } },
      },
    });
  }

  // Get friend requests
  async getFriendRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: FriendshipStatus.PENDING,
      },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
  }

  // Group CRUD
  async getUserGroups(userId: string) {
    return this.prisma.groupMembers.findMany({
      where: { userId },
      include: { group: true },
    });
  }

  // Update user profile
  async updateUserProfile(
    userId: string,
    updateData: Partial<{
      username: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }>,
    req?: any,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check for mail and username conflicts
    if (updateData.email && updateData.email !== user.email) {
      const existingUserByEmail = await this.findByEmail(updateData.email);
      if (existingUserByEmail && existingUserByEmail.id !== userId) {
        throw new ForbiddenException('Email is already in use');
      }
    }

    if (updateData.username && updateData.username !== user.username) {
      const existingUserByusername = await this.findByUsername(
        updateData.username,
      );
      if (existingUserByusername && existingUserByusername.id !== userId) {
        throw new ForbiddenException('Username is already in use');
      }
    }

    if (updateData.password) {
      try {
        const hashedPassword = await argon2.hash(updateData.password);
        updateData.password = hashedPassword;
      } catch (error) {
        console.error('Error hashing password with argon2:', error);
        throw error;
      }
    }

    // audit log
    await this.auditLogService.log(
      userId,
      'profile_update',
      'User updated their profile',
      req?.ip,
    );

    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        ...updateData,
      },
    });
  }

  // User search by username or email
  async searchUsers(
    query: string,
    userId: string,
    excludeUserId?: string,
    req?: any,
  ): Promise<
    Array<{
      id: string;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
    }>
  > {
    if (!query || query.trim().length === 0) {
      return [];
    }

    await this.auditLogService.log(
      userId,
      'user_search',
      `Searched for "${query}"`,
      req?.ip,
    );

    return this.prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
          excludeUserId ? { id: { not: excludeUserId } } : {},
        ],
      },

      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      take: 20, // Limit results to 20
    });
  }

  // blocked user logic
  async blockUser(blockerId: string, blockedId: string, req?: any) {
    if (blockerId == blockedId) {
      throw new Error('Cannot block yourself');
    }

    // audit log
    await this.auditLogService.log(
      blockerId,
      'block_user',
      `Blocked user ${blockedId}`,
      req?.ip,
    );

    return this.prisma.blockedUser.create({
      data: {
        blockerId,
        blockedId,
      },
    });
  }

  async unblockUser(blockerId: string, blockedId: string, req?: any) {
    // audit log
    await this.auditLogService.log(
      blockerId,
      'unblock_user',
      `Unblocked user ${blockedId}`,
      req?.ip,
    );

    return this.prisma.blockedUser.deleteMany({
      where: {
        blockerId,
        blockedId,
      },
    });
  }

  async isBlocked(userId: string, otherUserId: string) {
    const block = await this.prisma.blockedUser.findFirst({
      where: {
        OR: [
          {
            blockerId: userId,
            blockedId: otherUserId,
          },
          {
            blockerId: otherUserId,
            blockedId: userId,
          },
        ],
      },
    });

    return !!block;
  }
}
