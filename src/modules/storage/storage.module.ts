import { Module } from '@nestjs/common';
import { StorageService } from './services/storage.service';
import { StorageController } from './controller/storage.controller';

@Module({
  providers: [StorageService],
  controllers: [StorageController],
  exports: [StorageService],
})
export class StorageModule {}
