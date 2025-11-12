import { Module } from '@nestjs/common';
import { VoiceService } from './services/voice.service';
import { VoiceController } from './controller/voice.controller';

@Module({
  providers: [VoiceService],
  controllers: [VoiceController],
  exports: [VoiceService],
})
export class VoiceModule {}
