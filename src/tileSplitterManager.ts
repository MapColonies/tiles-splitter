import { join } from 'path';
import { Logger } from '@map-colonies/js-logger';
import { inject, singleton } from 'tsyringe';
import { QueueClient } from './clients/queueClient';
import { SERVICES } from './common/constants';
import { IConfig, IGenerateTilesConfig, IJobParams, IS3Config, ITaskParams, ITilesConfig, IVrtConfig } from './common/interfaces';
import { GDALUtilities } from './gdalUtilities';
import { StorageProviderType } from './common/enums';
import { OverseerClient } from './clients/overseerClient';

@singleton()
export class TileSplitterManager {
  private readonly splitAttempts: number;
  private readonly storageProvider: string;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.S3_CONFIG) private readonly s3Config: IS3Config,
    @inject(SERVICES.VRT_CONFIG) private readonly vrtConfig: IVrtConfig,
    @inject(SERVICES.GENERATE_TILES_CONFIG) private readonly generateTilesConfig: IGenerateTilesConfig,
    @inject(SERVICES.TILES_CONFIG) private readonly tilesConfig: ITilesConfig,
    private readonly queueClient: QueueClient,
    private readonly overseerClient: OverseerClient
  ) {
    this.splitAttempts = this.config.get<number>('splitAttempts');
    this.storageProvider = this.config.get<string>('storageProvider');
  }

  public async handleSplitTilesTask(): Promise<boolean> {
    const tilesTask = await this.queueClient.queueHandlerForTileSplittingTasks.dequeue<ITaskParams>();
    if (tilesTask) {
      const job = await this.queueClient.jobsClient.getJob<IJobParams, ITaskParams>(tilesTask.jobId as string);
      const gdalUtilities = new GDALUtilities(this.logger, this.vrtConfig, this.generateTilesConfig, this.queueClient, tilesTask);
      const jobId = tilesTask.jobId as string;
      const taskId = tilesTask.id;
      const attempts = tilesTask.attempts;
      const discreteId = tilesTask.parameters.discreteId;
      const tilesDirectoryPath = this.tilesConfig.path;
      const vrtPath = gdalUtilities.getVrtFilePath(discreteId);
      const baseTilesPath = this.storageProvider === StorageProviderType.FS ? join(tilesDirectoryPath) : join(`/vsis3/${this.s3Config.bucket}`);

      if (attempts <= this.splitAttempts) {
        try {
          this.logger.info(`Running split tiles task for taskId: ${taskId}, on jobId=${jobId}, attempt: ${attempts}`);

          await gdalUtilities.buildVrt(tilesTask, job?.parameters.fileNames as string[]);
          await gdalUtilities.generateTiles(tilesTask, baseTilesPath);
          const taskCompletePercentage = 100;
          await this.queueClient.queueHandlerForTileSplittingTasks.updateProgress(jobId, taskId, taskCompletePercentage);
          await this.queueClient.queueHandlerForTileSplittingTasks.ack(jobId, taskId);
          await this.overseerClient.notifyTaskEnded(jobId, taskId);
          this.logger.info(`TaskId: ${taskId}, on jobId=${jobId} Completed`);
        } catch (error) {
          await this.queueClient.queueHandlerForTileSplittingTasks.reject(jobId, taskId, true, (error as Error).message);
        } finally {
          if (this.storageProvider === StorageProviderType.S3) {
            await gdalUtilities.removeS3TempFiles(baseTilesPath, discreteId);
          }
          await gdalUtilities.removeVrtFile(vrtPath);
        }
      } else {
        await this.queueClient.queueHandlerForTileSplittingTasks.reject(jobId, taskId, false);
        await this.overseerClient.notifyTaskEnded(jobId, taskId);
      }
    }
    return Boolean(tilesTask);
  }
}
