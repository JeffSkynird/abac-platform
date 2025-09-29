import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import cors from '@fastify/cors'; 

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: ['error','warn','log'] }
  );
  await app.register(cors, {
    origin: 'http://localhost:4321',
    credentials: true,
  });

  const helmet: any = require('@fastify/helmet');
  await (app as any).register(helmet as any, { contentSecurityPolicy: false });

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
