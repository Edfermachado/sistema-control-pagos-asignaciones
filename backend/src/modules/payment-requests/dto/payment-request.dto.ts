import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentRequestStatus } from '../../../common/constants/domain.enums';

export class CreatePaymentRequestDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del proyecto es obligatorio.' })
  projectId!: string;

  @IsArray()
  @ArrayMinSize(1, {
    message: 'La solicitud debe incluir al menos una causación pendiente.',
  })
  @IsString({ each: true })
  accrualIds!: string[];
}

export class ReviewPaymentRequestDto {
  @IsIn([PaymentRequestStatus.APROBADA, PaymentRequestStatus.RECHAZADA], {
    message:
      '[RN-PAG-01] La decisión de revisión debe ser APROBADA o RECHAZADA.',
  })
  decision!: PaymentRequestStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
