import { Controller, Get, UseGuards, Param, Request } from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history/:roomId')
  async getChatHistory(@Request() req, @Param('roomId') roomId: string) {
    return this.chatService.getChatHistory(roomId, req.user.id);
  }
}
