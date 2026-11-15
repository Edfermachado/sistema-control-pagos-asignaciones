import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { UserRole } from '../../common/constants/domain.enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  buildStoredFileName,
  isAllowedUploadMimeType,
  MAX_UPLOAD_SIZE_BYTES,
} from './domain/upload-file.helper';

export const UPLOADS_DIRECTORY =
  process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  /**
   * Carga un comprobante de caja chica (PDF/PNG/JPEG) y retorna su URL pública.
   * Cumple RN-CAJA-03: rendición con comprobante adjunto.
   */
  @Post()
  @Roles(UserRole.GENERADOR, UserRole.RECEPTOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          mkdirSync(UPLOADS_DIRECTORY, { recursive: true });
          callback(null, UPLOADS_DIRECTORY);
        },
        filename: (_request, file, callback) => {
          callback(null, buildStoredFileName(file.originalname));
        },
      }),
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
      fileFilter: (_request, file, callback) => {
        if (!isAllowedUploadMimeType(file.mimetype)) {
          callback(
            new BadRequestException(
              '[RN-CAJA-03] Solo se permiten comprobantes PDF, PNG o JPEG.',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        '[RN-CAJA-03] Debe adjuntar un archivo de comprobante.',
      );
    }

    return {
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
