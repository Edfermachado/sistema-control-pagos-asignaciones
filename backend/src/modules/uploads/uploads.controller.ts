import {
  BadRequestException,
  Controller,
  Optional,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, MulterDiskFile } from 'multer';
import { mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { UserRole } from '../../common/constants/domain.enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  /**
   * Carga un comprobante de caja chica (PDF/PNG/JPEG) y retorna su URL pública.
   * Valida dinámicamente el parámetro global MAX_UPLOAD_SIZE_MB (RN-CAJA-03).
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
  async upload(@UploadedFile() file?: MulterDiskFile) {
    if (!file) {
      throw new BadRequestException(
        '[RN-CAJA-03] Debe adjuntar un archivo de comprobante.',
      );
    }

    const maxMbParam = await this.prisma?.systemParameter?.findUnique?.({
      where: { key: 'MAX_UPLOAD_SIZE_MB' },
    });
    const configuredMb = Number(maxMbParam?.value);
    if (Number.isFinite(configuredMb) && configuredMb > 0) {
      const maxBytes = configuredMb * 1024 * 1024;
      if (file.size > maxBytes) {
        try {
          unlinkSync(join(UPLOADS_DIRECTORY, file.filename));
        } catch {
          // Ignorar error de limpieza si el archivo ya fue removido
        }
        throw new BadRequestException(
          `[RN-CAJA-03] El archivo supera el tamaño máximo configurado de ${configuredMb} MB.`,
        );
      }
    }

    return {
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
