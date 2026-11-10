import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { MIN_PASSWORD_LENGTH } from '../../../common/security/crypto.helper';

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es requerida.' })
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  })
  password!: string;
}
