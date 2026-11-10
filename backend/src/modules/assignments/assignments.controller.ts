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
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  DeactivateAssignmentDto,
} from './dto/create-assignment.dto';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.GENERADOR)
  async create(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assignmentsService.createAssignment(dto, actor);
  }

  @Get()
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('beneficiaryId') beneficiaryId?: string,
    @Query('paymentGroupId') paymentGroupId?: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.assignmentsService.findAllAssignments({
      projectId,
      beneficiaryId,
      paymentGroupId,
      onlyActive:
        onlyActive !== undefined ? onlyActive === 'true' : undefined,
    });
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.GENERADOR)
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateAssignmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assignmentsService.deactivateAssignment(id, dto.endDate, actor);
  }
}
