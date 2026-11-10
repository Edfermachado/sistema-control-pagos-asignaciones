import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { MIN_ANNULMENT_REASON_LENGTH } from '../../../common/constants/domain.enums';

export class AnnulRecordDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la anulación justificada es obligatorio.' })
  @MinLength(MIN_ANNULMENT_REASON_LENGTH, {
    message: `[RN-GLOB-04] El motivo de anulación debe tener al menos ${MIN_ANNULMENT_REASON_LENGTH} caracteres.`,
  })
  reason!: string;
}
