import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateSystemParameterDto,
  UpdateSystemParameterDto,
} from './dto/system-parameter.dto';
import { ParametersService } from './parameters.service';

@Controller('parameters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParametersController {
  constructor(private readonly parametersService: ParametersService) {}

  /**
   * RN-SEG-02: todos los roles autenticados pueden consultar parámetros;
   * solo el ADMIN puede modificarlos.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll() {
    return this.parametersService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(
    @Body() dto: CreateSystemParameterDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.parametersService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSystemParameterDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.parametersService.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.parametersService.remove(id, actor);
  }
}
