
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { FileLoggerService } from './common/logging/file-logger.service';
import { LoggingInterceptor } from './common/logging/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const fileLogger = new FileLoggerService();

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

  // Swagger - Desabilitado em produção para otimizar inicialização
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Oracle Fusion Purchase Requisition API')
      .setDescription('API para criação e gerenciamento de requisições de compra no Oracle Fusion (Stateless)')
      .setVersion('1.0.0')
      .addTag('requisitions', 'Gerenciamento de requisições de compra')
      .addTag('ingestion', 'Ingestão de arquivos')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // File-based logging interceptor (JSON lines in logs/app.log)
  // Desabilitado em produção para otimizar inicialização (OCI Functions já tem logging próprio)
  if (configService.get('NODE_ENV') !== 'production') {
    app.useGlobalInterceptors(new LoggingInterceptor(fileLogger));
  }

  const port = configService.get('PORT', 8080);
  // Importante: escutar em 0.0.0.0 para OCI Functions
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Application is running on port ${port}`);
  if (configService.get('NODE_ENV') !== 'production') {
    logger.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
  }
}

bootstrap().catch((error) => {
  console.error('Error starting application:', error);
  process.exit(1);
});
