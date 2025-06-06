import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient();
    const data = context.switchToWs().getData();
    const event = context.getArgs()[0]; // Get event name from args

    // Log incoming message
    console.log(
      `[${new Date().toISOString()}] WS Request from ${client.id}: Event "${event}" with data:`,
      data,
    );

    return next.handle().pipe(
      tap(() => {
        // Log after the message is handled
        console.log(
          `[${new Date().toISOString()}] Handled WS event: "${event}" for ${client.id}`,
        );
      }),
    );
  }
}
