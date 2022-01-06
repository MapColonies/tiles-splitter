import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { QueueClient } from './clients/queueClient';
import { SERVICES } from './common/constants';
import { IConfig } from './common/interfaces';
import { GDALUtilities } from './gdalUtilities';

// interface IParameters {
//   resourceId: string;
//   resourceVersion: string;
//   layerRelativePath: string;
// }


@singleton()
export class TileSplitterManager {
  private readonly splitAttempts: number;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    // @inject(SERVICES.TILES_CONFIG) private readonly tilesConfig: ITilesConfig,
    // @inject(SERVICES.STORAGE_PROVIDER) private readonly storageProvider: IStorageProvider,
    private readonly queueClient: QueueClient,
    private readonly gdalUtilities: GDALUtilities
  ) {
    this.splitAttempts = this.config.get<number>('splitAttempts');
  }

  public async handleSplitTilesTask(): Promise<boolean> {
    const tilesTask = await this.queueClient.queueHandlerForTileSplittingTasks.dequeue();
    if (tilesTask) {
      const jobId = tilesTask.jobId;
      const taskId = tilesTask.id;
      const attempts = tilesTask.attempts;
      // const params = tilesTask.parameters as IParameters;
      // const layerRelativePath = params.layerRelativePath;

      if (attempts <= this.splitAttempts) {
        try {
          this.logger.info(`Running sync tiles task for taskId: ${tilesTask.id}, on jobId=${tilesTask.jobId}, attempt: ${attempts}`);
          // TODO: add GDAL logic here
          await this.gdalUtilities.buildVrt(tilesTask);
          await this.gdalUtilities.generateTiles()
          await this.queueClient.queueHandlerForTileSplittingTasks.ack(jobId, taskId);
        } catch (error) {
          await this.queueClient.queueHandlerForTileSplittingTasks.reject(jobId, taskId, true, (error as Error).message);
        }
      } else {
        await this.queueClient.queueHandlerForTileSplittingTasks.reject(jobId, taskId, false);
      }
    }
    return Boolean(tilesTask);
  }
}