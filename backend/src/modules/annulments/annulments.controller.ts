import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AnnulmentsService } from './annulments.service';
import { AnnulRecordDto } from './dto/create-annulment.dto';

@Controller('annulments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnulmentsController {
  constructor(private readonly annulmentsService: AnnulmentsService) {}

  /**
   * RN-SEG-02 y RN-PAG-03: Exclusivamente el RECEPTOR puede anular un pago y revertir saldos FIFO.
   */
  @Post('payments/:paymentId')
  @Roles(UserRole.RECEPTOR)
  async annulPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: AnnulRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.annulmentsService.annulPayment(paymentId, dto.reason, actor);
  }

  /**
   * RN-SEG-02: Exclusivamente el GENERADOR puede anular una causación no pagada.
   */
  @Post('accruals/:accrualId')
  @Roles(UserRole.GENERADOR)
  async annulAccrual(
    @Param('accrualId') accrualId: string,
    @Body() dto: AnnulRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.annulmentsService.annulUnpaidAccrual(
      accrualId,
      dto.reason,
      actor,
    );
  }

  /**
   * RN-SEG-02 / RN-CAUS-04: el GENERADOR anula un lote completo no pagado.
   */
  @Post('accrual-batches/:batchId')
  @Roles(UserRole.GENERADOR)
  async annulAccrualBatch(
    @Param('batchId') batchId: string,
    @Body() dto: AnnulRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.annulmentsService.annulAccrualBatch(
      batchId,
      dto.reason,
      actor,
    );
  }

  /**
   * RN-SEG-02 / RN-PAG-01: el GENERADOR anula una solicitud sin pagos válidos.
   */
  @Post('payment-requests/:paymentRequestId')
  @Roles(UserRole.GENERADOR)
  async annulPaymentRequest(
    @Param('paymentRequestId') paymentRequestId: string,
    @Body() dto: AnnulRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.annulmentsService.annulPaymentRequest(
      paymentRequestId,
      dto.reason,
      actor,
    );
  }

  /**
   * RN-GLOB-04 / RN-CAJA-03: anulación de vales según estado y rol.
   */
  @Post('petty-cash-vouchers/:voucherId')
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async annulPettyCashVoucher(
    @Param('voucherId') voucherId: string,
    @Body() dto: AnnulRecordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.annulmentsService.annulPettyCashVoucher(
      voucherId,
      dto.reason,
      actor,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll() {
    return this.annulmentsService.findAllAnnulments();
  }
}
