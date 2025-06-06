import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Catch(WsException)
export class WsExceptionFilter implements WsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const message = exception.message || 'Unknown Websocket Error!';

    this.logger.warn(`Websocket Exception: ${message}`);

    client.emit('exception', {
      status: 'error',
      message,
    });
  }
}
