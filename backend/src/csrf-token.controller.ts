import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller()
export class CsrfTokenController {
  @Get('csrf-token')
  getCsrfToken(@Req() req: Request) {
    return {
      csrfToken: (req as Request & { csrfToken: () => string }).csrfToken(),
    };
  }
}
