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

@WebSocketGateway({ cors: true })
@UseFilters(WsExceptionFilter)
@UseInterceptors(LoggingInterceptor)
@UseGuards(JwtGuard)
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private server: Server;

  constructor(private readonly chatService: ChatService) {}

  afterInit(server: Server) {
    this.server = server;
    console.log('WebSocket server initialized');
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    return { status: 'joined', roomId };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(roomId);
    return { status: 'left', roomId };
  }

  @SubscribeMessage('sendMessage')
  @UsePipes(new MessageValidationPipe())
  async handleMessage(
    @MessageBody() message: MessageDto,
    @ConnectedSocket() client: Socket,
  ) {
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
