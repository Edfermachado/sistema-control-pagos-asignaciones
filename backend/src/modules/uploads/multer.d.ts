declare module 'multer' {
  export interface MulterDiskFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
  }

  export interface DiskStorageOptions {
    destination?: (
      req: unknown,
      file: MulterDiskFile,
      callback: (error: Error | null, destination: string) => void,
    ) => void;
    filename?: (
      req: unknown,
      file: MulterDiskFile,
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }

  export function diskStorage(options: DiskStorageOptions): unknown;
}

