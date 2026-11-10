import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccrualsService } from './accruals.service';
import { GenerateAccrualBatchDto } from './dto/generate-accrual-batch.dto';

@Controller('accruals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccrualsController {
  constructor(private readonly accrualsService: AccrualsService) {}

  @Post('batches/preview')
  @Roles(UserRole.GENERADOR)
  async previewBatch(@Body() dto: GenerateAccrualBatchDto) {
    return this.accrualsService.previewAccrualBatch(dto);
  }

  @Post('batches')
  @Roles(UserRole.GENERADOR)
  async generateBatch(
    @Body() dto: GenerateAccrualBatchDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.accrualsService.generateAccrualBatch(dto, actor);
  }

  @Get('beneficiary/:beneficiaryId/pending')
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async findPendingByBeneficiary(@Param('beneficiaryId') beneficiaryId: string) {
    return this.accrualsService.findPendingAccrualsByBeneficiary(beneficiaryId);
  }
}
