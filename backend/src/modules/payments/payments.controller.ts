import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * RN-SEG-02: Exclusivamente el RECEPTOR registra entregas de fondos.
   */
  @Post()
  @Roles(UserRole.RECEPTOR)
  async register(
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.registerPayment(dto, actor);
  }

  @Get()
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('paymentRequestId') paymentRequestId?: string,
  ) {
    return this.paymentsService.findAllPayments(beneficiaryId, paymentRequestId);
  }
}
