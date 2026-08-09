import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { startSimulator } from './simulator';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
  if (process.env.ENABLE_IOT_SIMULATOR === 'true') void startSimulator();
}
bootstrap();
