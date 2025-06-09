import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Request } from 'express';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService, // add this
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the context is for WebSocket or HTTP
    if (context.getType() === 'ws') {
      const client: Socket = context.switchToWs().getClient();
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers['authorization']?.replace('Bearer ', '');

      if (!token) {
        throw new UnauthorizedException('Missing WebSocket token');
      }

      try {
        const user = await this.jwtService.verifyAsync(token);
        client.data.user = user;
        return true;
      } catch (err) {
        throw new UnauthorizedException('Invalid WebSocket token');
      }
    }

    // HTTP context
    const request: Request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Missing HTTP token');
    }

    try {
      const user = await this.jwtService.verifyAsync(token); // add this
      request['user'] = user; // add this
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid HTTP token');
    }
  }
}
