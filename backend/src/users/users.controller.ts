import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Send friend request
  @Post('friend-request')
  async sendFriendRequest(@Request() req, @Body('friendId') friendId: string) {
    const userId = req.user.id;
    return this.usersService.sendFriendRequest(userId, friendId);
  }

  // Accept friend request
  @Post('friend-request/:id/accept')
  async acceptFriendRequest(@Request() req, @Param('id') requestId: string) {
    return this.usersService.acceptFriendRequest(req.user.id, requestId);
  }

  // Reject
  @Post('friend-request/:id/reject')
  async rejectFriendRequest(@Request() req, @Param('id') requestId: string) {
    return this.usersService.rejectFriendRequest(req.user.id, requestId);
  }

  // List all friends
  @Get('friends')
  async getFriends(@Request() req) {
    return this.usersService.getFriends(req.user.id);
  }

  // List all friend requests
  @Get('friend-requests')
  async getFriendRequests(@Request() req) {
    return this.usersService.getFriendRequests(req.user.id);
  }
}
