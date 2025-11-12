import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './controller/expenses.controller';

@Module({
  providers: [ExpensesService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}
