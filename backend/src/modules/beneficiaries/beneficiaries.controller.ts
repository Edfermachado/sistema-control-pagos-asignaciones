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
import { UserRole } from '../../common/constants/domain.enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BeneficiariesService } from './beneficiaries.service';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
} from './dto/create-beneficiary.dto';

@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  /**
   * RN-SEG-02: Solo GENERADOR crea o actualiza beneficiarios.
   */
  @Post()
  @Roles(UserRole.GENERADOR)
  async create(
    @Body() dto: CreateBeneficiaryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.beneficiariesService.createBeneficiary(dto, actor);
  }

  /**
   * RN-SEG-02: Todos los roles autenticados pueden consultar el catálogo de beneficiarios.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(@Query('search') search?: string) {
    return this.beneficiariesService.findAllBeneficiaries(search);
  }

  @Patch(':id')
  @Roles(UserRole.GENERADOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBeneficiaryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.beneficiariesService.updateBeneficiary(id, dto, actor);
  }
}
