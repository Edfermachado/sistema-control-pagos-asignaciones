import { BadRequestException } from '@nestjs/common';
import { type MulterDiskFile } from 'multer';
import { PrismaService } from '../../../prisma/prisma.service';
import { UploadsController } from '../uploads.controller';
import {
  buildStoredFileName,
  isAllowedUploadMimeType,
} from './upload-file.helper';

describe('upload-file.helper & UploadsController (RN-CAJA-03 Comprobantes Adjuntos)', () => {
  describe('isAllowedUploadMimeType', () => {
    it('debe aceptar PDF, PNG y JPEG (Happy Path)', () => {
      // Arrange
      const mimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];

      // Act
      const results = mimeTypes.map((mime) => isAllowedUploadMimeType(mime));

      // Assert
      expect(results).toEqual([true, true, true]);
    });

    it('debe aceptar tipos MIME permitidos independientemente de mayúsculas (Edge Case)', () => {
      // Arrange
      const upperMime = 'APPLICATION/PDF';

      // Act
      const allowed = isAllowedUploadMimeType(upperMime);

      // Assert
      expect(allowed).toBe(true);
    });

    it('debe rechazar tipos no permitidos o vacíos (Violación RN-CAJA-03)', () => {
      // Arrange
      const invalidTypes = ['application/zip', 'text/html', ''];

      // Act
      const results = invalidTypes.map((mime) => isAllowedUploadMimeType(mime));

      // Assert
      expect(results).toEqual([false, false, false]);
    });
  });

  describe('buildStoredFileName', () => {
    it('debe conservar la extensión permitida y generar un nombre único (Happy Path)', () => {
      // Arrange
      const original = 'FACTURA.PDF';

      // Act
      const first = buildStoredFileName(original);
      const second = buildStoredFileName(original);

      // Assert
      expect(first.endsWith('.pdf')).toBe(true);
      expect(first).not.toBe(second);
    });

    it('debe usar .bin cuando el archivo no posee extensión o esta no es permitida (Edge Case)', () => {
      // Arrange
      const noExt = 'comprobante_sin_extension';
      const dangerousExt = 'malicioso.exe';

      // Act
      const storedNoExt = buildStoredFileName(noExt);
      const storedDangerous = buildStoredFileName(dangerousExt);

      // Assert
      expect(storedNoExt.endsWith('.bin')).toBe(true);
      expect(storedDangerous.endsWith('.bin')).toBe(true);
    });

    it('debe aceptar extensiones JPEG y PNG normalizadas a minúsculas (Happy Path Variantes)', () => {
      // Arrange & Act
      const jpgFile = buildStoredFileName('ticket.JPEG');
      const pngFile = buildStoredFileName('soporte.PNG');

      // Assert
      expect(jpgFile.endsWith('.jpeg')).toBe(true);
      expect(pngFile.endsWith('.png')).toBe(true);
    });
  });

  describe('UploadsController.upload (RN-CAJA-03 y MAX_UPLOAD_SIZE_MB)', () => {
    const sampleFile: MulterDiskFile = {
      fieldname: 'file',
      originalname: 'recibo_lab.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 512 * 1024,
      destination: '/tmp/uploads',
      filename: 'uuid-recibo-no-existe.pdf',
      path: '/tmp/uploads/uuid-recibo-no-existe.pdf',
    };

    it('debe retornar la URL pública y metadatos del comprobante cuando respeta MAX_UPLOAD_SIZE_MB (Happy Path)', async () => {
      // Arrange
      const prismaMock = {
        systemParameter: {
          findUnique: jest.fn().mockResolvedValueOnce({
            key: 'MAX_UPLOAD_SIZE_MB',
            value: '2',
          }),
        },
      };
      const controller = new UploadsController(
        prismaMock as unknown as PrismaService,
      );

      // Act
      const response = await controller.upload(sampleFile);

      // Assert
      expect(prismaMock.systemParameter.findUnique).toHaveBeenCalledWith({
        where: { key: 'MAX_UPLOAD_SIZE_MB' },
      });
      expect(response).toEqual({
        url: '/uploads/uuid-recibo-no-existe.pdf',
        originalName: 'recibo_lab.pdf',
        mimeType: 'application/pdf',
        size: 512 * 1024,
      });
    });

    it('debe operar con el límite por defecto cuando PrismaService o MAX_UPLOAD_SIZE_MB no están definidos (Edge Case)', async () => {
      // Arrange
      const controllerWithoutPrisma = new UploadsController(undefined);
      const prismaWithoutParam = {
        systemParameter: {
          findUnique: jest.fn().mockResolvedValueOnce(null),
        },
      };
      const controllerWithoutParam = new UploadsController(
        prismaWithoutParam as unknown as PrismaService,
      );

      // Act
      const resA = await controllerWithoutPrisma.upload(sampleFile);
      const resB = await controllerWithoutParam.upload(sampleFile);

      // Assert
      expect(resA.url).toBe('/uploads/uuid-recibo-no-existe.pdf');
      expect(resB.size).toBe(512 * 1024);
    });

    it('debe lanzar BadRequestException si falta el archivo o si supera MAX_UPLOAD_SIZE_MB configurado (Violación RN-CAJA-03)', async () => {
      // Arrange
      const prismaMock = {
        systemParameter: {
          findUnique: jest.fn().mockResolvedValueOnce({
            key: 'MAX_UPLOAD_SIZE_MB',
            value: '1',
          }),
        },
      };
      const controller = new UploadsController(
        prismaMock as unknown as PrismaService,
      );
      const oversizedFile: MulterDiskFile = {
        ...sampleFile,
        size: 2 * 1024 * 1024,
      };

      // Act & Assert (Sin archivo)
      await expect(controller.upload(undefined)).rejects.toThrow(
        BadRequestException,
      );

      // Act & Assert (Excede parámetro dinámico)
      await expect(controller.upload(oversizedFile)).rejects.toThrow(
        'tamaño máximo configurado de 1 MB',
      );
    });
  });
});
