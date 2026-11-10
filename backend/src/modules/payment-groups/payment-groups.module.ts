import { Module } from '@nestjs/common';
import { PaymentGroupsController } from './payment-groups.controller';
import { PaymentGroupsService } from './payment-groups.service';

@Module({
  controllers: [PaymentGroupsController],
  providers: [PaymentGroupsService],
  exports: [PaymentGroupsService],
})
export class PaymentGroupsModule {}
