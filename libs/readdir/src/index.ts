/**
 * * Heavily based on https://www.npmjs.com/package/readdirp
 */

import { Readable } from 'stream';
import { readdir, stat } from 'fs/promises';
import { join as joinPath } from 'path';

export enum ReadMode {
  file,
  dir,
  both,
}

export interface StreamOptions {
  fileExtension?: string;
  readMode?: ReadMode | keyof typeof ReadMode;
}

export interface Node {
  files?: string[];
  depth: number;
  path: string;
}

export class RecursiveDirReadStream extends Readable {
  public static readonly expectedErrors = new Set(['ENOENT', 'EPERM', 'EACCES', 'ELOOP']);

  private readonly fileExtension: string | null;

  private readonly readMode: ReadMode;

  private readonly _nodes: Promise<Node>[];
  private _current?: Node;

  private _reading = false;

  public constructor(public readonly root: string, options?: StreamOptions) {
    super({
      objectMode: true,
      encoding: 'utf8',
      highWaterMark: 1000000
    });

    this._nodes = [this._explore(root, 1)];

    this.fileExtension = options?.fileExtension ?? null;
    this.readMode = options?.readMode
      ? (typeof options.readMode === 'string' ? ReadMode[options.readMode] : options.readMode)
      : ReadMode.file;
  }

  private _onError(e: any): void {
    if (RecursiveDirReadStream.expectedErrors.has(e.code) && !this.destroyed) return void this.emit('warn', e);
    return this.destroy(e);
  }

  private async _explore(path: string, depth: number) {
    let files: string[] | undefined;
    try {
      files = await readdir(path);
    } catch (e) {
      this._onError(e);
    }

    return { files, depth, path };
  }

  // Base readable class requires this to be public
  public async _read(batch: number) {
    if (this._reading) return;
    this._reading = true;

    try {
      while (!this.destroyed && batch > 0) {
        if (this._current?.files && this._current.files.length > 0) {
          const { files = [], depth, path } = this._current;

          for (const entry of files.splice(0, batch)) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (this.destroyed) return;

            const full = joinPath(path, entry);

            await stat(full)
              .then(stats => {
                if (stats.isDirectory()) {
                  this._nodes.push(this._explore(full, depth + 1));
                  if (this.readMode !== ReadMode.file) this.push(full);
                } else if (this.readMode !== ReadMode.dir && (!this.fileExtension || entry.endsWith(this.fileExtension))) {
                  this.push(full);
                }
              })
              .catch(e => this._onError(e));

            batch--;
          }
        } else {
          const parent = this._nodes.pop();
          if (!parent) {
            this.push(null);
            break;
          }

          this._current = await parent;
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (this.destroyed) return;
        }
      }
    } catch (e) {
      this.destroy(e);
    } finally {
      this._reading = false;
    }
  }

  // @ts-ignore
  public [Symbol.asyncIterator](): AsyncIterableIterator<string>;
}

export const readdirRecurse = (root: string, options?: StreamOptions) => new RecursiveDirReadStream(root, options);

export const readdirRecursePromise = (root: string, options?: StreamOptions) => new Promise<string[]>((resolve, reject) => {
  const files: string[] = [];
  readdirRecurse(root, options)
    .on('data', entry => files.push(entry))
    .on('end', () => resolve(files))
    .on('error', error => reject(error));
});
