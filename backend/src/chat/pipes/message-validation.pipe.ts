import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { MessageDto } from '../dto';

@Injectable()
export class MessageValidationPipe implements PipeTransform {
  transform(value: MessageDto) {
    const { content, to, groudId } = value;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new BadRequestException('Message content is required');
    }

    if (!to && !groudId) {
      throw new BadRequestException(
        'Either "to" or "groudId" must be provided for the message',
      );
    }

    return value;
  }
}
