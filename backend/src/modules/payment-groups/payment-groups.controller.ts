import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePaymentGroupDto } from './dto/create-payment-group.dto';
import { PaymentGroupsService } from './payment-groups.service';

@Controller('payment-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentGroupsController {
  constructor(private readonly paymentGroupsService: PaymentGroupsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @Body() dto: CreatePaymentGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentGroupsService.createPaymentGroup(dto, actor);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(@Query('onlyActive') onlyActive?: string) {
    const activeFlag = onlyActive === 'false' ? false : true;
    return this.paymentGroupsService.findAllPaymentGroups(activeFlag);
  }
}
