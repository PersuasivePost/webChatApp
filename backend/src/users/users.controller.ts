import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  @Get('groups')
  async getUserGroups(@Request() req) {
    return this.usersService.getUserGroups(req.user.id);
  }

  // Update user profile
  @Patch('profile')
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user.id;
    const updatedUser = await this.usersService.updateUserProfile(
      userId,
      updateProfileDto,
    );

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  // Search users
  @Get('search')
  async searchUsers(@Request() req, @Query('query') query: string) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query parameter cannot be empty');
    }

    return this.usersService.searchUsers(query, req.user.id);
  }
}
