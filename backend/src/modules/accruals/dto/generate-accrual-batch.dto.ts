import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateAccrualBatchDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del proyecto es obligatorio.' })
  projectId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del grupo de pago es obligatorio.' })
  paymentGroupId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}
