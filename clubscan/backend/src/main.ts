import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers (Phase 6 §3).
  app.use(helmet());

  // CORS allowlist (bearer tokens, no cookies).
  const origins = config.get<string>('CORS_ORIGINS', '*');
  app.enableCors({
    origin: origins === '*' ? true : origins.split(',').map((o) => o.trim()),
    credentials: false,
  });

  const prefix = config.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();

  // OpenAPI (Zod-aware).
  patchNestJsSwagger();
  const swagger = new DocumentBuilder()
    .setTitle('ClubScan API')
    .setDescription('Safer, more transparent nightlife — ClubScan REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`ClubScan API listening on :${port}/${prefix}`);
}

void bootstrap();
