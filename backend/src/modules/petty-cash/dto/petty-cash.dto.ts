import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePettyCashDto {
  @IsString()
  @IsNotEmpty({ message: 'El código de la caja chica es obligatorio.' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre de la caja chica es obligatorio.' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'El ID del proyecto asociado es obligatorio.' })
  projectId!: string;

  @IsNotEmpty({ message: 'El monto autorizado en USD es obligatorio.' })
  authorizedAmount!: string | number;
}

export class OpenPettyCashPeriodDto {
  @IsString()
  @IsNotEmpty({ message: 'El período mensual YYYY-MM es obligatorio.' })
  yearMonth!: string;

  @IsNotEmpty({ message: 'El monto de reposición inicial es obligatorio (puede ser 0).' })
  initialReplenishment!: string | number;
}

export class RequestVoucherDto {
  @IsString()
  @IsNotEmpty({ message: 'El código único del vale es obligatorio.' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del responsable que recibe el vale es obligatorio.' })
  beneficiaryName!: string;

  @IsString()
  @IsNotEmpty({ message: 'El concepto del gasto de caja chica es obligatorio.' })
  concept!: string;

  @IsNotEmpty({ message: 'El monto solicitado en USD es obligatorio.' })
  requestedAmount!: string | number;
}

export class SettleVoucherDto {
  @IsNotEmpty({ message: 'El monto real gastado según factura/comprobante es obligatorio.' })
  settledAmount!: string | number;

  @IsString()
  @IsNotEmpty({ message: 'La referencia de factura o comprobante es obligatoria.' })
  invoiceReference!: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
