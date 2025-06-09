import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, User } from '../../generated/prisma';
import { PrismaService } from 'src/mail/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
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
  async sendFriendRequest(userId: string, friendId: string) {
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

    return friendRequest;
  }

  // Accept friend request
  async acceptFriendRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.friendId !== userId)
      throw new ForbiddenException('Not authorized to accept this request');
    if (request.status !== FriendshipStatus.PENDING)
      throw new ForbiddenException('Request is not pending');

    return this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: FriendshipStatus.ACCEPTED },
    });
  }

  // Reject friend request
  async rejectFriendRequest(userId: string, requestId: string) {
    const request = await this.prisma.friendship.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Friend request not found');
    if (request.friendId !== userId)
      throw new ForbiddenException('Not authorized to reject this request');
    if (request.status !== FriendshipStatus.PENDING)
      throw new ForbiddenException('Request is not pending');

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
    excludeUserId?: string,
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
}
