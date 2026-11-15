import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSystemParameterDto {
  @IsString()
  @IsNotEmpty({ message: 'La clave del parámetro es obligatoria.' })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message:
      'La clave del parámetro solo puede contener letras, números y guiones bajos.',
  })
  @MaxLength(80)
  key!: string;

  @IsString()
  @IsNotEmpty({ message: 'El valor del parámetro es obligatorio.' })
  value!: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción del parámetro es obligatoria.' })
  @MaxLength(255)
  description!: string;
}

export class UpdateSystemParameterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El valor del parámetro no puede estar vacío.' })
  value?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripción del parámetro no puede estar vacía.' })
  @MaxLength(255)
  description?: string;
}
