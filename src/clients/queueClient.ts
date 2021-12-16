import { TaskHandler as QueueHandler } from '@map-colonies/mc-priority-queue';
import { inject, singleton } from 'tsyringe';
import { Logger } from '@map-colonies/js-logger';
import { IQueueConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';

@singleton()
export class QueueClient {
  public readonly queueHandlerForTileSplittingTasks: QueueHandler;

  public constructor(
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.QUEUE_CONFIG) private readonly queueConfig: IQueueConfig
  ) {
    this.queueHandlerForTileSplittingTasks = new QueueHandler(
      logger,
      this.queueConfig.jobType,
      this.queueConfig.tilesTaskType,
      this.queueConfig.jobManagerBaseUrl,
      this.queueConfig.heartbeatManagerBaseUrl,
      this.queueConfig.dequeueIntervalMs,
      this.queueConfig.heartbeatIntervalMs
    );
  }
}
