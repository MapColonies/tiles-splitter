import { $ } from 'zx';
import config from 'config';
import { join } from 'path';
import { Transform } from 'stream';
import { createWriteStream, unlinkSync } from 'fs';
import { inject, singleton } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { SERVICES } from './common/constants';
import { IGenerateTilesOptions, ITaskParams, IVrtOptions } from './common/interfaces';
import { QueueClient } from './clients/queueClient';
import { ITaskResponse } from '@map-colonies/mc-priority-queue';

type TransformCallback = (error?: Error | null, data?: any) => void;

@singleton()
export class GDALUtilities {
  public constructor(@inject(SERVICES.LOGGER) private readonly logger: Logger, private readonly queueClient: QueueClient) {}

  public async buildVrt(task: ITaskResponse): Promise<void> {
    const discreteId = (task.parameters as ITaskParams).discreteId;
    const fileNamesList = (task.parameters as ITaskParams).fileNames;
    const sourcesOriginDir = (task.parameters as ITaskParams).originDirectory;
    const sourcesListFilePath = config.get<string>('vrt.sourcesListFilePath');
    const vrtPath = this.getVrtFilePath(discreteId);
    const options: IVrtOptions = {
      vrtNodata: '0',
      outputSRS: 'EPSG:4326',
      resampling: 'average',
      addAlpha: true,
    };

    // create text file with the included file names
    this.createFileNamesList(fileNamesList, sourcesOriginDir, sourcesListFilePath);
    // execute gdalbuildvrt cmd
    await $`gdalbuildvrt -vrtnodata ${options.vrtNodata} -a_srs ${options.outputSRS} -r ${options.resampling} -input_file_list ${sourcesListFilePath} ${vrtPath}`;
    // removed the sources list file
    unlinkSync(sourcesListFilePath);
  }

  public async generateTiles(): Promise<void> {
    const options: IGenerateTilesOptions = {
      resampling: 'average',
      tmscompatible: true,
      profile: 'geodetic',
      srcnodata: '0',
      zoom: 13,
      verbose: false,
    };

    const outputStream = new Transform({
      transform: this.gdalProgressFunc,
    });

    await $`gdal2tiles.py --zoom=${options.zoom} --profile=${options.profile} --resampling=${options.resampling} --srcnodata=${options.srcnodata} --tmscompatible /app/vrtOutputs/Ayosh_v1.0.vrt /app/vol2/AyoshTiles`.pipe(outputStream);
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
      await this.queueClient.queueHandlerForTileSplittingTasks.updateProgress(
        '27f6ef71-c59c-4855-8ee2-433da56bebb7',
        '1e923070-2307-47d5-a81f-cf0018daca3f',
        percentNum
      );
    }
    callback();
  };

  private getVrtFilePath(discreteId: string): string {
    const vrtFileName = `${discreteId}.vrt`;
    const vrtOutputDirPath = config.get<string>('vrt.outputDirPath');
    const vrtOutputPath = join(vrtOutputDirPath, vrtFileName);
    return vrtOutputPath;
  }

  private createFileNamesList(fileNames: string[], sourcesOriginDir: string, sourcesListFilePath: string): void {
    const sourceMountPath = config.get<string>('sourceMountPath');
    const writeStream = createWriteStream(sourcesListFilePath);
    fileNames.forEach((fileName) => writeStream.write(join(sourceMountPath, sourcesOriginDir, fileName + '\n')));
    writeStream.end();
  }
}
