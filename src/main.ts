
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Validaçao Global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS 
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger 
  const config = new DocumentBuilder()
    .setTitle('Oracle Fusion Purchase Requisition API')
    .setDescription('API para criação e gerenciamento de requisições de compra no Oracle Fusion (Stateless)')
    .setVersion('1.0.0')
    .addTag('requisitions', 'Gerenciamento de requisições de compra')
    .addTag('ingestion', 'Ingestão de arquivos')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Debug endpoint
  app.use('/debug', (req, res) => {
    res.json({
      fusionBaseUrl: process.env.FUSION_BASE_URL,
      fusionVersion: process.env.FUSION_REST_VERSION,
      allEnv: Object.keys(process.env).filter(key => key.includes('FUSION'))
    });
  });

  const port = configService.get('PORT', 3000);
  await app.listen(port);
  
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
