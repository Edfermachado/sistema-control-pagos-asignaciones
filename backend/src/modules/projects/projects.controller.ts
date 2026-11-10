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
  ProjectArea,
  ProjectStatus,
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
  CreateProjectDto,
  UpdateProjectStatusDto,
} from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(UserRole.GENERADOR)
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projectsService.createProject(dto, actor);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR)
  async findAll(
    @Query('area') area?: ProjectArea,
    @Query('status') status?: ProjectStatus,
  ) {
    return this.projectsService.findAllProjects(area, status);
  }

  @Patch(':id/status')
  @Roles(UserRole.GENERADOR)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProjectStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.projectsService.updateProjectStatus(id, dto.status, actor);
  }
}
