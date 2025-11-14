import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configure as serverlessExpress } from '@vendia/serverless-express';
import { Handler } from 'aws-lambda';
import * as express from 'express';

let cachedServer: Handler;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    // Validação Global
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // CORS gerenciado pela Function URL do Lambda - não configurar aqui para evitar duplicação

    // Swagger
    const config = new DocumentBuilder()
      .setTitle('Oracle Fusion Purchase Requisition API')
      .setDescription('API para criação e gerenciamento de requisições de compra no Oracle Fusion')
      .setVersion('1.0.0')
      .addTag('procurement/purchase-requisitions', 'Purchase Requisitions')
      .addTag('observability', 'Health e Métricas')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    await app.init();

    cachedServer = serverlessExpress({ app: expressApp });
  }

  return cachedServer;
}

export const handler: Handler = async (event, context, callback) => {
  const server = await bootstrap();
  return server(event, context, callback);
};

