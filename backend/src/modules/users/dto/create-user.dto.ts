import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/constants/domain.enums';
import { MIN_PASSWORD_LENGTH } from '../../../common/security/crypto.helper';

export class CreateUserDto {
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  fullName!: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password!: string;

  @IsEnum(UserRole, {
    message:
      '[RN-SEG-02] El rol debe ser estrictamente ADMIN, GENERADOR o RECEPTOR.',
  })
  role!: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo no puede estar vacío.' })
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole, {
    message:
      '[RN-SEG-02] El rol debe ser estrictamente ADMIN, GENERADOR o RECEPTOR.',
  })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  password?: string;
}

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
