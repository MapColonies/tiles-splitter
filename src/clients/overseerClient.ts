import { inject, singleton } from 'tsyringe';
import { HttpClient, ILogger } from '@map-colonies/mc-utils';
import { SERVICES } from '../common/constants';
import { IConfig } from '../common/interfaces';

@singleton()
export class OverseerClient extends HttpClient {
  public constructor(@inject(SERVICES.LOGGER) logger: ILogger, @inject(SERVICES.CONFIG) config: IConfig) {
    super(logger, config.get('overseerUrl'), 'DiscreteOverseer', config.get('httpRetry'));
  }

  public async notifyTaskEnded(jobId: string, taskId: string): Promise<void> {
    const url = `/tasks/${jobId}/${taskId}/completed`;
    await this.post(url);
  }
}
