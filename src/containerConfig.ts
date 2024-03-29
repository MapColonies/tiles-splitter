import config from 'config';
import { getOtelMixin } from '@map-colonies/telemetry';
import { trace } from '@opentelemetry/api';
import { DependencyContainer } from 'tsyringe/dist/typings/types';
import jsLogger, { LoggerOptions } from '@map-colonies/js-logger';
import { SERVICES } from './common/constants';
import { tracing } from './common/tracing';
import { InjectionObject, registerDependencies } from './common/dependencyRegistration';
import { IGenerateTilesConfig, IQueueConfig, IS3Config, ITilesConfig, IVrtConfig } from './common/interfaces';

export interface RegisterOptions {
  override?: InjectionObject<unknown>[];
  useChild?: boolean;
}

export const registerExternalValues = (options?: RegisterOptions): DependencyContainer => {
  const loggerConfig = config.get<LoggerOptions>('telemetry.logger');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const logger = jsLogger({ ...loggerConfig, prettyPrint: loggerConfig.prettyPrint, mixin: getOtelMixin() });
  const queueConfig = config.get<IQueueConfig>('queue');
  const tilesConfig = config.get<ITilesConfig>('tiles');
  const vrtConfig = config.get<IVrtConfig>('vrt');
  const s3Config = config.get<IS3Config>('S3');
  const generateTilesConfig = config.get<IGenerateTilesConfig>('generateTiles');

  tracing.start();
  const tracer = trace.getTracer('app');

  const dependencies: InjectionObject<unknown>[] = [
    { token: SERVICES.CONFIG, provider: { useValue: config } },
    { token: SERVICES.LOGGER, provider: { useValue: logger } },
    { token: SERVICES.QUEUE_CONFIG, provider: { useValue: queueConfig } },
    { token: SERVICES.TILES_CONFIG, provider: { useValue: tilesConfig } },
    { token: SERVICES.VRT_CONFIG, provider: { useValue: vrtConfig } },
    { token: SERVICES.GENERATE_TILES_CONFIG, provider: { useValue: generateTilesConfig } },
    { token: SERVICES.S3_CONFIG, provider: { useValue: s3Config } },
    { token: SERVICES.TRACER, provider: { useValue: tracer } },
    {
      token: 'onSignal',
      provider: {
        useValue: {
          useValue: async (): Promise<void> => {
            await Promise.all([tracing.stop()]);
          },
        },
      },
    },
  ];

  return registerDependencies(dependencies, options?.override, options?.useChild);
};
