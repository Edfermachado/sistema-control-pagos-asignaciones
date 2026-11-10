import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PaymentRequestStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreatePaymentRequestDto,
  ReviewPaymentRequestDto,
} from './dto/payment-request.dto';
import { PaymentRequestsService } from './payment-requests.service';

@Controller('payment-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentRequestsController {
  constructor(
    private readonly paymentRequestsService: PaymentRequestsService,
  ) {}

  @Post()
  @Roles(UserRole.GENERADOR)
  async create(
    @Body() dto: CreatePaymentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.createPaymentRequest(dto, actor);
  }

  @Patch(':id/send')
  @Roles(UserRole.GENERADOR)
  async send(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.sendPaymentRequest(id, actor);
  }

  @Patch(':id/review')
  @Roles(UserRole.RECEPTOR)
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewPaymentRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.reviewPaymentRequest(id, dto, actor);
  }

  @Patch(':id/close')
  @Roles(UserRole.RECEPTOR)
  async close(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.closePaymentRequest(id, actor);
  }

  @Get()
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: PaymentRequestStatus,
  ) {
    return this.paymentRequestsService.findAllPaymentRequests(projectId, status);
  }
}
