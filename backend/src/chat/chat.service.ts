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
}
