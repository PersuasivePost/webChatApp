import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  // CSRF protection middleware
  app.use(
    csurf({
      cookie: {
        key: '_csrf',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
      value: (req) => req.cookies._csrf || req.headers['x-csrf-token'],
    }),
  );

  // CSRF error handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403).json({ message: 'Invalid CSRF token' });
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
