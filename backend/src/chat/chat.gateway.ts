import {
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { MessageDto } from './dto/message.dto';
import { WsExceptionFilter } from './filters';
import { JwtGuard } from 'src/auth/guards';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { MessageValidationPipe } from './pipes/message-validation.pipe';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { UsersService } from 'src/users/users.service';
import { AuditLogService } from 'src/audit/audit-log.service';

@WebSocketGateway({ cors: true })
@UseFilters(WsExceptionFilter)
@UseInterceptors(LoggingInterceptor)
@UseGuards(JwtGuard)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private server: Server;

  private redisClient;

  constructor(
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async afterInit(server: Server) {
    this.server = server;
    // Redis connection
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    this.redisClient = pubClient;
    this.server.adapter(createAdapter(pubClient, subClient));
    console.log('WebSocket server initialized with Redis adapter');
  }

  async handleConnection(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      await this.markUserOnline(userId);
      console.log(`User ${userId} connected`);
    }
    // console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.user?.id;
    if (userId) {
      await this.markUserOffline(userId);
      console.log(`User ${userId} disconnected`);
    }
    //console.log(`Client disconnected: ${client.id}`);
  }

  private async markUserOnline(userId: string) {
    await this.redisClient.sAdd('online_users', userId);
    await this.redisClient.set(`last_seen:${userId}`, Date.now().toString());
  }

  private async markUserOffline(userId: string) {
    await this.redisClient.sRem('online_users', userId);
    await this.redisClient.set(`last_seen:${userId}`, Date.now().toString());
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsers = await this.redisClient.sMembers('online_users');
    return { onlineUsers };
  }

  @SubscribeMessage('getLastSeen')
  async handleGetLastSeen(@MessageBody('userId') userId: string) {
    const timestamp = await this.redisClient.get(`last_seen:${userId}`);
    return {
      userId,
      lastSeen: timestamp ? new Date(Number(timestamp)).toISOString() : null,
    };
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // audit log
    await this.auditLogService.log(
      client.data.user.id,
      'join_group',
      `Joined group ${roomId}`,
      client.handshake.address,
    );

    client.join(roomId);
    return { status: 'joined', roomId };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // audit log
    await this.auditLogService.log(
      client.data.user.id,
      'leave_group',
      `Left group ${roomId}`,
      client.handshake.address,
    );

    client.leave(roomId);
    return { status: 'left', roomId };
  }

  @SubscribeMessage('sendMessage')
  @UsePipes(new MessageValidationPipe())
  async handleMessage(
    @MessageBody() message: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // block unnblock user logic
    const senderId = client.data.user.id;
    const recipientId = message.to;

    if (recipientId) {
      const isBlocked = await this.usersService.isBlocked(
        senderId,
        recipientId,
      );

      if (isBlocked) {
        return {
          status: 'error',
          message:
            'You cannot send messages to this user as they have blocked you.',
        };
      }

      await this.auditLogService.log(
        client.data.user.id,
        'send_message',
        `Sent message in room ${message.groudId || message.to}`,
        client.handshake.address,
      );
    }

    // continue
    const saved = await this.chatService.saveMessage(
      message,
      client.data.user.id,
    );
    const targetRoom = message.groudId || message.to;
    if (targetRoom) {
      this.server.to(targetRoom).emit('receivedMessage', saved);
    } else {
      //
      console.log('Neither groupId nor to provided in message');
    }
    // this.server
    //   .to(message.groudId || message.to)
    //   .emit('receivedMessage', saved);
    return { status: 'ok' };
  }

  @SubscribeMessage('deleteMessageForEveryone')
  async handleDeleteMessageForEveryone(
    @MessageBody('messageId') messageId: string,
    @ConnectedSocket() client: Socket,
  ) {
    // audit log
    await this.auditLogService.log(
      client.data.user.id,
      'delete_message',
      `Deleted message ${messageId}`,
      client.handshake.address,
    );

    try {
      const result = await this.chatService.deleteMessageForEveryone(
        messageId,
        client.data.user.id,
      );
      this.server.emit('messageDeleted', result);
      return { status: 'deletedForEveryone', messageId };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('deleteMessageForMe')
  async handleDeleteForMe(
    @MessageBody('messageId') messageId: string,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const result = await this.chatService.deleteMessageForMe(
        messageId,
        client.data.user.id,
      );
      return { status: 'deletedForMe', messageId };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
}
