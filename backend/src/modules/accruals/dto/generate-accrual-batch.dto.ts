import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class GenerateAccrualBatchDto {
  @IsString()
  @IsNotEmpty({ message: 'El código único del lote de causación es obligatorio.' })
  code!: string;

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
