import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
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
