import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageDto } from './dto/message.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(message: MessageDto, senderId: string) {
    return this.prisma.message.create({
      data: {
        content: message.content,
        senderId,
        groupId: message.groudId || null,
        privateChatId: message.to || null,
      },
      include: {
        sender: true,
      },
    });
  }

  async deleteMessageForEveryone(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.senderId !== userId) {
      throw new Error('Unauthorized or message not found');
    }

    await this.prisma.message.delete({
      where: {
        id: messageId,
      },
    });
  }

  async deleteMessageForMe(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) throw new Error('Message not found');

    await this.prisma.deletedMessage.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      update: {},
      create: {
        messageId,
        userId,
      },
    });
    return { messageId };
  }

  async getChatHistory(
    roomId: string,
    userId: string,
    cursor?: string,
    limit: number = 20,
  ) {
    // prevent abuse
    if (limit < 1) limit = 1;
    if (limit > 100) limit = 100;

    // For group chat
    const groupMessages = await this.prisma.message.findMany({
      where: {
        groupId: roomId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        sender: true,
      },
    });

    // For private chat
    const privateMessages = await this.prisma.message.findMany({
      where: {
        privateChatId: roomId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      include: {
        sender: true,
      },
    });

    const messages = [...groupMessages, ...privateMessages].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const nextCursor =
      messages.length > 0 ? messages[messages.length - 1].id : null;

    return {
      messages,
      nextCursor,
      hasMore: messages.length === limit,
    };
  }
}
