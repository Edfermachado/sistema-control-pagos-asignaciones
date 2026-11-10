import { Module } from '@nestjs/common';
import { AnnulmentsController } from './annulments.controller';
import { AnnulmentsService } from './annulments.service';

@Module({
  controllers: [AnnulmentsController],
  providers: [AnnulmentsService],
  exports: [AnnulmentsService],
})
export class AnnulmentsModule {}
