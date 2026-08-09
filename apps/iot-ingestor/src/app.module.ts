import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MqttService } from './mqtt.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, MqttService],
})
export class AppModule {}
