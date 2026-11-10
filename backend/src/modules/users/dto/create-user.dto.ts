import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
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

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
