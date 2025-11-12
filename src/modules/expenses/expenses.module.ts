import { Module } from '@nestjs/common';
import { ExpensesService } from './services/expenses.service';
import { ExpensesController } from './controller/expenses.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities';
import { CategoriesModule } from '../categories/categories.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { StorageModule } from '../storage/storage.module';
import { OcrModule } from '../ocr/ocr.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Expense]),
    CategoriesModule,
    PaymentMethodsModule,
    StorageModule,
    OcrModule,
    VoiceModule,
  ],
  providers: [ExpensesService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
