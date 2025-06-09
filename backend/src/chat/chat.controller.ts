import {
  Controller,
  Get,
  UseGuards,
  Param,
  Request,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('history/:roomId')
  async getChatHistory(
    @Request() req,
    @Param('roomId') roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    if(parsedLimit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    return this.chatService.getChatHistory(
      roomId,
      req.user.id,
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
