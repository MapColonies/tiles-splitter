import { join } from 'path';
import { Transform } from 'stream';
import { createWriteStream, promises as fsPromises } from 'fs';
import { $ } from 'zx';
import config from 'config';
import { Logger } from '@map-colonies/js-logger';
import { ITaskResponse } from '@map-colonies/mc-priority-queue';
import { IGenerateTilesConfig, ITaskParams, IVrtConfig } from './common/interfaces';
import { QueueClient } from './clients/queueClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TransformCallback = (error?: Error | null, data?: any) => void;

// offset of less then quoter pixel size of zoom 23
const BBOX_START_OFFSET = 0.00000002;

export class GDALUtilities {
  private readonly jobId: string;
  private readonly taskId: string;

  public constructor(
    private readonly logger: Logger,
    private readonly vrtConfig: IVrtConfig,
    private readonly generateTilesConfig: IGenerateTilesConfig,
    private readonly queueClient: QueueClient,
    private readonly task: ITaskResponse<ITaskParams>
  ) {
    this.jobId = this.task.jobId as string;
    this.taskId = this.task.id;
  }

  public async buildVrt(task: ITaskResponse<ITaskParams>,files: string[]): Promise<void> {
    const discreteId = task.parameters.discreteId;
    const fileNamesList = files;
    const sourcesOriginDir = task.parameters.originDirectory;
    const bbox = task.parameters.bbox;

    try {
      const vrtPath = this.getVrtFilePath(discreteId);
      // create text file with the included file names for vrt the creation
      this.createFileNamesList(fileNamesList, sourcesOriginDir, this.vrtConfig.sourcesListFilePath);
      //is bbox is on tile border gdal generate empty tile outside of the start border.
      //this prevent the generation of those empty tiles and therefore preventing them from overriding valid tiles
      const minX = bbox[0] + BBOX_START_OFFSET;
      const minY = bbox[1] + BBOX_START_OFFSET;
      const maxX = bbox[2];
      const maxY = bbox[3];

      let args = [
        '-a_srs', // output srs
        this.vrtConfig.outputSRS,
        '-te', // bbox
        minX,
        minY,
        maxX,
        maxY,
        '-vrtnodata', // no data value
        this.vrtConfig.nodata,
        '-r', // resampling
        this.vrtConfig.resampling,
      ];

      if (this.vrtConfig.useBandCount) {
        const inputBandCount = this.vrtConfig.inputBandCount;
        for (let band = 1; band <= inputBandCount; band++) {
          args.push('-b', band);
        }
      }
      if (this.vrtConfig.addAlpha) {
        args.push('-addalpha');
      }

      args = [
        ...args,
        '-input_file_list', // input text file path
        this.vrtConfig.sourcesListFilePath,
        vrtPath,
      ];

      this.logger.debug(`creating VRT file in path: ${vrtPath}`);
      await $`gdalbuildvrt ${args}`;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.error(`failed to create VRT file: ${error}`);
      throw error;
    } finally {
      // removed the sources list file
      await fsPromises.unlink(this.vrtConfig.sourcesListFilePath);
    }
  }

  public async generateTiles(task: ITaskResponse<ITaskParams>, tilesBasePath: string): Promise<void> {
    const discreteId = task.parameters.discreteId;
    const version = task.parameters.version;
    const layerRelativePath = task.parameters.layerRelativePath;
    const tilesPath = join(tilesBasePath, layerRelativePath);
    const vrtPath = this.getVrtFilePath(discreteId);
    const minZoom = task.parameters.minZoom;
    const maxZoom = task.parameters.maxZoom;
    const zoomLevels = `${minZoom}-${maxZoom}`;
    let active = true;

    try {
      const outputStream = new Transform({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transform: (chunk: any, encoding: BufferEncoding, callback: TransformCallback): void => {
          if (active) {
            this.gdalProgressFunc(chunk, encoding, callback);
          } else {
            callback();
          }
        },
      });

      const args = [
        '-z', // zoom levels
        zoomLevels,
        '-p', // profile
        this.generateTilesConfig.profile,
        '-r', // resmapling
        this.generateTilesConfig.resampling,
        '-a', // src no data value
        this.generateTilesConfig.srcnodata,
        '--tmscompatible', // tiling scheme (2:1)
        '--no-kml', // ignore kml files
        '--exclude', // ignores empty tiles
        vrtPath, // input file path
        tilesPath, // tiles outhput path
      ];

      this.logger.debug(`generating tiles for discrete id: ${discreteId} version: ${version} in path: ${tilesPath}`);
      const cmd = $`gdal2tiles.py ${args}`;
      cmd.stdout.pipe(outputStream);
      await cmd;
      active = false;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.error(`failed to generate tiles: ${error}`);
      throw error;
    }
  }

  public async removeVrtFile(vrtPath: string): Promise<void> {
    try {
      this.logger.info(`removing vrt file from path: ${vrtPath}`);
      await fsPromises.unlink(vrtPath);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.error(`failed to remove vrt file from path: ${vrtPath}, error: ${error}`);
    }
  }

  public async removeS3TempFiles(baseTilesPath: string, discreteId: string): Promise<void> {
    const s3TempFilesPath = join(baseTilesPath, discreteId);
    try {
      this.logger.info(`removing s3 temp files from directory: ${s3TempFilesPath}`);
      await fsPromises.rmdir(s3TempFilesPath, { recursive: true });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.error(`failed to remove temp s3 files from path: ${s3TempFilesPath}, error: ${error}`);
    }
  }

  public getVrtFilePath(discreteId: string): string {
    const vrtFileName = `${discreteId}.vrt`;
    const vrtOutputPath = join(this.vrtConfig.outputDirPath, vrtFileName);
    return vrtOutputPath;
  }

  private createFileNamesList(fileNames: string[], sourcesOriginDir: string, sourcesListFilePath: string): void {
    try {
      this.logger.debug(`creating input text file on: ${sourcesListFilePath}`);
      const sourceMountPath = config.get<string>('sourceMountPath');
      const writeStream = createWriteStream(sourcesListFilePath);
      fileNames.forEach((fileName) => writeStream.write(join(sourceMountPath, sourcesOriginDir, fileName + '\n')));
      writeStream.end();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      this.logger.error(`failed to create input text file: ${sourcesListFilePath}, error: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly gdalProgressFunc = (chunk: any, encoding: BufferEncoding, callback: TransformCallback): void => {
    let gdalOutput = '';
    let lastProgressPercent = 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const chunkBuffer = Buffer.from(chunk, 'utf8');
    gdalOutput += chunkBuffer.toString('utf8');

    const outputArr = gdalOutput
      .split('.')
      .map((x) => Number(x))
      .filter((x) => !isNaN(x));

    const currentProgressPercent = outputArr[outputArr.length - 1];

    if (currentProgressPercent !== lastProgressPercent && outputArr.length) {
      lastProgressPercent = currentProgressPercent;
      const percentNum = lastProgressPercent;
      void this.queueClient.queueHandlerForTileSplittingTasks.updateProgress(this.jobId, this.taskId, percentNum).then(() => {
        callback();
      });
    } else {
      callback();
    }
  };
}
