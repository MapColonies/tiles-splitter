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

export interface IS3Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucket: string;
  forcePathStyle: boolean;
  sslEnabled: boolean;
  virtualHosting: boolean;
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

export interface IVrtConfig {
  outputDirPath: string;
  sourcesListFilePath: string;
  nodata: string;
  outputSRS: string;
  resampling: string;
  addAlpha: boolean;
}

export interface IGenerateTilesConfig {
  resampling: string;
  tmscompatible: boolean;
  profile: string;
  srcnodata: string;
  zoom: string;
  verbose: boolean;
}
