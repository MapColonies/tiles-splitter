export interface IConfig {
  get: <T>(setting: string) => T;
  has: (setting: string) => boolean;
}

export interface OpenApiConfig {
  filePath: string;
  basePath: string;
  jsonPath: string;
  uiPath: string;
}

export interface IQueueConfig {
  jobManagerBaseUrl: string;
  heartbeatManagerBaseUrl: string;
  dequeueIntervalMs: number;
  heartbeatIntervalMs: number;
  jobType: string;
  tilesTaskType: string;
  tocTaskType: string;
}

export interface ITilesConfig {
  path: string;
  format: string;
  uploadBatchSize: number;
  sigIsNeeded: boolean;
}

export interface ITaskParams {
  discreteId: string;
  version: string;
  fileNames: string[];
  originDirectory: string;
  layerRelativePath: string;
  minZoom: number;
  maxZoom: number;
  bbox: number[];
}

export interface IVrtOptions {
  vrtNodata: string;
  outputSRS: string,
  resampling: string,
  addAlpha: boolean,
  bbox?: Array<number>
}

export interface IGenerateTilesOptions {
  resampling: string;
  tmscompatible: boolean;
  profile: string;
  srcnodata: string;
  zoom: number;
  verbose: boolean;
}
