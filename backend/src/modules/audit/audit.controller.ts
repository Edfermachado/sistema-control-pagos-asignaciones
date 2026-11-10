import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Consulta del audit_log restringida a ADMIN y RECEPTOR según matriz RN-SEG-02.
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTOR)
  async findAll(
    @Query('tableName') tableName?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAllLogs({
      tableName,
      userId,
      action,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
