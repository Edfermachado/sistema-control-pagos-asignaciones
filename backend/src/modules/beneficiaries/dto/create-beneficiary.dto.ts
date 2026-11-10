import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBeneficiaryDto {
  @IsString()
  @IsNotEmpty({ message: 'La cédula o documento de identidad (DNI) es obligatorio.' })
  dni!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre completo del beneficiario es obligatorio.' })
  fullName!: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico del beneficiario no es válido.' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bankInfo?: string;
}

export class UpdateBeneficiaryDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bankInfo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
