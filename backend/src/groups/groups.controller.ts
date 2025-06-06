import {
  Controller,
  UseGuards,
  Request,
  Body,
  HttpStatus,
  HttpException,
  Post,
  Get,
} from '@nestjs/common';
import { JwtGuard } from 'src/auth/guards';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
@UseGuards(JwtGuard)
export class GroupsController {
  usersService: any;
  constructor(private readonly groupsService: GroupsService) {}

  @Post('create')
  async createGroup(@Request() req, @Body() dto: CreateGroupDto) {
    if (!dto.name || !dto.description) {
      throw new HttpException(
        'Group name and description are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.groupsService.createGroup(
        req.user.id,
        dto.name,
        dto.description,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('join')
  async joinGroup(@Request() req, @Body('inviteCode') inviteCode: string) {
    try {
      return await this.groupsService.joinGroup(req.user.id, inviteCode);
    } catch (error) {
      throw new HttpException(
        error.message,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('groups')
  async getUserGroups(@Request() req) {
    return this.usersService.getUserGroups(req.user.id);
  }
}
