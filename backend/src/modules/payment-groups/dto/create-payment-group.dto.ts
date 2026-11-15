import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Periodicity } from '../../../common/constants/domain.enums';

export class CreatePaymentGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del grupo de pago es obligatorio.' })
  name!: string;

  @IsEnum(Periodicity, {
    message:
      '[RN-CAT-03] La periodicidad debe ser SEMANAL, QUINCENAL o MENSUAL.',
  })
  periodicity!: Periodicity;

  @IsString()
  @IsNotEmpty({ message: 'Las reglas de fecha de corte son obligatorias.' })
  cutoffRules!: string;
}

export class UpdatePaymentGroupDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre del grupo no puede estar vacío.' })
  name?: string;

  @IsOptional()
  @IsEnum(Periodicity, {
    message:
      '[RN-CAT-03] La periodicidad debe ser SEMANAL, QUINCENAL o MENSUAL.',
  })
  periodicity?: Periodicity;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Las reglas de corte no pueden estar vacías.' })
  cutoffRules?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePaymentGroupPeriodDto {
  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
