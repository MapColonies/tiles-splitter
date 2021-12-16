import { readPackageJsonSync } from '@map-colonies/read-pkg';

export const SERVICE_NAME = readPackageJsonSync().name ?? 'tiles-splitter';
export const DEFAULT_SERVER_PORT = 80;

export const IGNORED_OUTGOING_TRACE_ROUTES = [/^.*\/v1\/metrics.*$/];
export const IGNORED_INCOMING_TRACE_ROUTES = [/^.*\/docs.*$/];

/* eslint-disable @typescript-eslint/naming-convention */
export const SERVICES: Record<string, symbol> = {
  LOGGER: Symbol('Logger'),
  CONFIG: Symbol('Config'),
  TRACER: Symbol('Tracer'),
  METER: Symbol('Meter'),
  QUEUE_CONFIG: Symbol('IQueueconfig'),
  TILES_CONFIG: Symbol('ITilesConfig'),
  CRYPTO_CONFIG: Symbol('ICryptoConfig'),
  GATEWAY_CONFIG: Symbol('IGatewayConfig'),
  STORAGE_PROVIDER: Symbol('storageProvider'),
};
/* eslint-enable @typescript-eslint/naming-convention */
