import { $, fs } from 'zx';
import config from 'config';
import { join } from 'path';
import { Transform } from 'stream';
import { createWriteStream, promises as fsPromises } from 'fs';
import { Logger } from '@map-colonies/js-logger';
import { IGenerateTilesConfig, ITaskParams, IVrtConfig } from './common/interfaces';
import { QueueClient } from './clients/queueClient';
import { ITaskResponse } from '@map-colonies/mc-priority-queue';

type TransformCallback = (error?: Error | null, data?: any) => void;

export class GDALUtilities {
  private readonly jobId: string;
  private readonly taskId: string;

  public constructor(
    private readonly logger: Logger,
    private readonly vrtConfig: IVrtConfig,
    private readonly generateTilesConfig: IGenerateTilesConfig,
    private readonly queueClient: QueueClient,
    private readonly task: ITaskResponse
  ) {
    this.jobId = this.task.jobId;
    this.taskId = this.task.id;
  }

  public async buildVrt(task: ITaskResponse): Promise<void> {
    const discreteId = (task.parameters as ITaskParams).discreteId;
    const fileNamesList = (task.parameters as ITaskParams).fileNames;
    const sourcesOriginDir = (task.parameters as ITaskParams).originDirectory;
    try {
      const vrtPath = this.getVrtFilePath(discreteId);
      // create text file with the included file names for vrt the creation
      this.createFileNamesList(fileNamesList, sourcesOriginDir, this.vrtConfig.sourcesListFilePath);
      // execute gdalbuildvrt cmd
      await $`gdalbuildvrt -vrtnodata ${this.vrtConfig.nodata} -a_srs ${this.vrtConfig.outputSRS} -r ${this.vrtConfig.resampling} -input_file_list ${this.vrtConfig.sourcesListFilePath} ${vrtPath}`;
    } catch (error) {
      this.logger.error(`failed to create VRT file: ${error}`);
      throw error;
    } finally {
      // removed the sources list file
      await fsPromises.unlink(this.vrtConfig.sourcesListFilePath);
    }
  }

  public async generateTiles(task: ITaskResponse, tilesBasePath: string): Promise<void> {
    const discreteId = (task.parameters as ITaskParams).discreteId;
    const layerRelativePath = (task.parameters as ITaskParams).layerRelativePath;
    const tilesPath = join(tilesBasePath, layerRelativePath);
    const vrtPath = this.getVrtFilePath(discreteId);
    const minZoom = (task.parameters as ITaskParams).minZoom;
    const maxZoom = (task.parameters as ITaskParams).maxZoom;
    const zoomLevels = `${minZoom}-${maxZoom}`;
    try {
      const outputStream = new Transform({
        transform: this.gdalProgressFunc,
      });

      await $`gdal2tiles.py --zoom=${zoomLevels} --profile=${this.generateTilesConfig.profile} --resampling=${this.generateTilesConfig.resampling} --srcnodata=${this.generateTilesConfig.srcnodata} --tmscompatible --no-kml ${vrtPath} ${tilesPath}`.pipe(
        outputStream
      );
    } catch (error) {
      this.logger.error(`failed to generate tiles: ${error}`);
      throw error;
    }
  }

  private gdalProgressFunc = async (chunk: any, encoding: BufferEncoding, callback: TransformCallback) => {
    let gdalOutput = '';
    let lastProgressPercent = 0;

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
      await this.queueClient.queueHandlerForTileSplittingTasks.updateProgress(this.jobId, this.taskId, percentNum);
    }
    callback();
  };

  public async removeVrtFile(vrtPath: string): Promise<void> {
    try {
      this.logger.info(`removing vrt file from path: ${vrtPath}`);
      await fsPromises.unlink(vrtPath);
    } catch (error) {
      this.logger.error(`failed to remove vrt file from path: ${vrtPath}, error: ${error}`);
    }
  }

  public async removeS3TempFiles(baseTilesPath: string, discreteId: string): Promise<void> {
    const s3TempFilesPath = join(baseTilesPath, discreteId);
    try {
      this.logger.info(`removing s3 temp files from directory: ${s3TempFilesPath}`);
      await fsPromises.rmdir(s3TempFilesPath, { recursive: true });
    } catch (error) {
      this.logger.error(`failed to remove temp s3 files from path: ${s3TempFilesPath}, error: ${error}`);
    }
  }

  public getVrtFilePath(discreteId: string): string {
    const vrtFileName = `${discreteId}.vrt`;
    const vrtOutputPath = join(this.vrtConfig.outputDirPath, vrtFileName);
    return vrtOutputPath;
  }

  private createFileNamesList(fileNames: string[], sourcesOriginDir: string, sourcesListFilePath: string): void {
    const sourceMountPath = config.get<string>('sourceMountPath');
    const writeStream = createWriteStream(sourcesListFilePath);
    fileNames.forEach((fileName) => writeStream.write(join(sourceMountPath, sourcesOriginDir, fileName + '\n')));
    writeStream.end();
  }
}
