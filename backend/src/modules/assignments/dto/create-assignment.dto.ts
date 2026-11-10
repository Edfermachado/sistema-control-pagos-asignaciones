import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString()
  @IsNotEmpty()
  beneficiaryId!: string;

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  paymentGroupId!: string;

  @IsNotEmpty({ message: 'El monto por período en USD es obligatorio.' })
  amountPerPeriod!: string | number;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DeactivateAssignmentDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
