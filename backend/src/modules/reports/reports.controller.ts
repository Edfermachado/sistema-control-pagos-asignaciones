import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '../../common/constants/domain.enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async getSummary(@Query('projectId') projectId?: string) {
    return this.reportsService.getExecutiveSummaryAndDebts(projectId);
  }

  @Get('payments/:paymentId/pdf')
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async downloadIndividualReceipt(
    @Param('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.reportsService.generateIndividualReceiptPdf(paymentId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('payment-requests/:paymentRequestId/pdf')
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  async downloadConsolidatedRequest(
    @Param('paymentRequestId') paymentRequestId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.reportsService.generateConsolidatedRequestPdf(paymentRequestId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
