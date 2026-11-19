import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterPaymentDto {
  @IsOptional()
  @IsString()
  receiptCode?: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID de la solicitud de pago aprobada es obligatorio.' })
  paymentRequestId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del beneficiario que recibe el pago es obligatorio.' })
  beneficiaryId!: string;

  @IsNotEmpty({ message: 'El monto a pagar en USD es obligatorio.' })
  amount!: string | number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
