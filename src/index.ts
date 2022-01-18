/* eslint-disable import/first */
// this import must be called before the first import of tsyring
import 'reflect-metadata';
import { createServer } from 'http';
import { createTerminus } from '@godaddy/terminus';
import { Logger } from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import config from 'config';
import { DEFAULT_SERVER_PORT, SERVICES } from './common/constants';
import { getApp } from './app';
import { TileSplitterManager } from './tileSplitterManager';

interface IServerConfig {
  port: string;
}

const serverConfig = config.get<IServerConfig>('server');
const port: number = parseInt(serverConfig.port) || DEFAULT_SERVER_PORT;

const app = getApp();
const logger = container.resolve<Logger>(SERVICES.LOGGER);
const tileSplitterManager = container.resolve(TileSplitterManager);
const stubHealthcheck = async (): Promise<void> => Promise.resolve();
const server = createTerminus(createServer(app), { healthChecks: { '/liveness': stubHealthcheck, onSignal: container.resolve('onSignal') } });

server.listen(port, () => {
  logger.info(`app started on port ${port}`);
});

const mainLoop = async (): Promise<void> => {
  const isRunning = true;
  const dequeueIntervalMs = config.get<number>('queue.dequeueIntervalMs');
  //eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (isRunning) {
    try {
      const taskProcessed = await tileSplitterManager.handleSplitTilesTask();
      if (!taskProcessed) {
        await new Promise((resolve) => setTimeout(resolve, dequeueIntervalMs));
      }
    } catch (error) {
      logger.fatal(`mainLoop: Error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      await new Promise((resolve) => setTimeout(resolve, dequeueIntervalMs));
    }
  }
};

void mainLoop();
