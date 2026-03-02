declare module 'y-websocket/bin/utils' {
    import { WebSocket } from 'ws';
    import { IncomingMessage } from 'http';

    export function setupWSConnection(
        conn: WebSocket,
        req: IncomingMessage,
        options?: { docName?: string; gc?: boolean }
    ): void;
}

declare module 'multer' {
    import { RequestHandler } from 'express';

    interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    }

    interface Options {
        storage?: any;
        limits?: { fileSize?: number; files?: number };
        fileFilter?: any;
    }

    interface Multer {
        (options?: Options): { any(): RequestHandler; single(field: string): RequestHandler; array(field: string, max?: number): RequestHandler };
        memoryStorage(): any;
    }

    const multer: Multer & ((options?: Options) => {
        any(): RequestHandler;
        single(field: string): RequestHandler;
        array(field: string, max?: number): RequestHandler;
    });

    export = multer;
}

declare module 'adm-zip' {
    interface ZipEntry {
        entryName: string;
        isDirectory: boolean;
        getData(): Buffer;
        getDataAsync(callback: (data: Buffer, err: string) => void): void;
    }

    class AdmZip {
        constructor(fileNameOrRawData?: string | Buffer);
        getEntries(): ZipEntry[];
        extractAllTo(targetPath: string, overwrite?: boolean): void;
        addFile(entryName: string, data: Buffer, comment?: string, attr?: number): void;
        addLocalFolder(localPath: string, zipPath?: string, filter?: RegExp | Function): void;
        writeZip(targetFileName?: string): void;
        toBuffer(): Buffer;
    }

    export = AdmZip;
}
