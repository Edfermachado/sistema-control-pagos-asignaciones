import { Controller, Get } from '@nestjs/common';
import { HealthService, SystemHealthResponse } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<SystemHealthResponse> {
    return this.healthService.checkSystemHealth();
  }
}
