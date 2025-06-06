import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, User } from '../../generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: FriendshipStatus.PENDING,
      },
    });
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
}
