import { IsDateString, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import {
  ProjectArea,
  ProjectScope,
  ProjectStatus,
} from '../../../common/constants/domain.enums';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'El código único del proyecto es obligatorio.' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre del proyecto es obligatorio.' })
  name!: string;

  @IsEnum(ProjectArea, {
    message: '[RN-CAT-01] El área debe ser FISICA, QUIMICA o BIOLOGIA.',
  })
  area!: ProjectArea;

  @IsEnum(ProjectScope, {
    message: '[RN-CAT-01] El ámbito debe ser INTERNO o EXTERNO.',
  })
  scope!: ProjectScope;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
