import {
  Body,
  Controller,
  Param,
  Patch,
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
import {
  CreatePettyCashDto,
  OpenPettyCashPeriodDto,
  RequestVoucherDto,
  SettleVoucherDto,
} from './dto/petty-cash.dto';
import { PettyCashService } from './petty-cash.service';

@Controller('petty-cashes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PettyCashController {
  constructor(private readonly pettyCashService: PettyCashService) {}

  @Post()
  @Roles(UserRole.GENERADOR)
  async create(
    @Body() dto: CreatePettyCashDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.createPettyCash(dto, actor);
  }

  @Post(':pettyCashId/periods')
  @Roles(UserRole.GENERADOR)
  async openPeriod(
    @Param('pettyCashId') pettyCashId: string,
    @Body() dto: OpenPettyCashPeriodDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.openMonthlyPeriod(pettyCashId, dto, actor);
  }

  @Patch('periods/:periodId/approve')
  @Roles(UserRole.RECEPTOR)
  async approvePeriod(
    @Param('periodId') periodId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.approvePeriodOpening(periodId, actor);
  }

  @Post('periods/:periodId/vouchers')
  @Roles(UserRole.GENERADOR)
  async requestVoucher(
    @Param('periodId') periodId: string,
    @Body() dto: RequestVoucherDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.requestVoucher(periodId, dto, actor);
  }

  @Patch('vouchers/:voucherId/disburse')
  @Roles(UserRole.RECEPTOR)
  async disburseVoucher(
    @Param('voucherId') voucherId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.approveAndDisburseVoucher(voucherId, actor);
  }

  @Patch('vouchers/:voucherId/settle')
  @Roles(UserRole.GENERADOR)
  async settleVoucher(
    @Param('voucherId') voucherId: string,
    @Body() dto: SettleVoucherDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.settleVoucher(voucherId, dto, actor);
  }

  @Patch('periods/:periodId/close')
  @Roles(UserRole.RECEPTOR)
  async closePeriod(
    @Param('periodId') periodId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.pettyCashService.closeMonthlyPeriod(periodId, actor);
  }
}
