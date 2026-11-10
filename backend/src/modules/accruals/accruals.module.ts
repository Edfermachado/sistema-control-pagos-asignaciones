import { Module } from '@nestjs/common';
import { AccrualsController } from './accruals.controller';
import { AccrualsService } from './accruals.service';

@Module({
  controllers: [AccrualsController],
  providers: [AccrualsService],
  exports: [AccrualsService],
})
export class AccrualsModule {}
