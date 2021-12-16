import jsLogger from '@map-colonies/js-logger';
import { DependencyContainer } from 'tsyringe';
import { TileSplitterManager } from '../../src/tileSplitterManager';
import { getTask } from '../mocks/files/task';
import { QueueClient } from '../../src/clients/queueClient';

import { configMock, init as initConfig, clear as clearConfig } from '../mocks/config';
import { registerExternalValues } from '../testContainerConfig';

let tileSplitterManager: TileSplitterManager;
let dequeueStub: jest.SpyInstance;
let ackStubForTileTasks: jest.SpyInstance;
let rejectStubForTileTasks: jest.SpyInstance;

let container: DependencyContainer;
let queueClient: QueueClient;

describe('syncManager', () => {
  beforeEach(() => {
    initConfig();

    container = registerExternalValues({ useChild: true });
    queueClient = container.resolve(QueueClient);

    tileSplitterManager = new TileSplitterManager(jsLogger({ enabled: false }), configMock, queueClient);

    ackStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSplittingTasks, 'ack').mockImplementation(async () => Promise.resolve());
    rejectStubForTileTasks = jest.spyOn(queueClient.queueHandlerForTileSplittingTasks, 'reject').mockImplementation(async () => Promise.resolve());
  });

  afterEach(() => {
    clearConfig();
    container.reset();
    container.clearInstances();
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  describe('# tile splitter manager', () => {
    it('should successfully split tiles', async function () {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const queueClient = container.resolve(QueueClient);
      const task = getTask();
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSplittingTasks, 'dequeue').mockResolvedValue(task);

      // todo: add more logic here

      ackStubForTileTasks.mockImplementation(async () => {
        if (dequeueStub.mock.calls.length !== 1) {
          throw new Error('invalid call order: dequeueStub should be called before ack');
        }
        return Promise.resolve();
      });

      // expectation;
      await expect(tileSplitterManager.handleSplitTilesTask()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledTimes(0);
      expect(ackStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id);
    });

    it('should reject task due max attempts with buffers', async function () {
      // mock
      const queueClient = container.resolve(QueueClient);
      const task = getTask();
      task.attempts = 6;
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSplittingTasks, 'dequeue').mockResolvedValue(task);

      // action
      const action = async () => {
        await tileSplitterManager.handleSplitTilesTask();
      };
      // expectation;
      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(0);
      expect(rejectStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false);
    });

    it('should reject task due max attempts with streams', async function () {
      // mock
      const queueClient = container.resolve(QueueClient);
      const task = getTask();
      task.attempts = 6;
      dequeueStub = jest.spyOn(queueClient.queueHandlerForTileSplittingTasks, 'dequeue').mockResolvedValue(task);

      // action
      const action = async () => {
        await tileSplitterManager.handleSplitTilesTask();
      };
      // expectation;
      await expect(action()).resolves.not.toThrow();
      expect(dequeueStub).toHaveBeenCalledTimes(1);
      expect(ackStubForTileTasks).toHaveBeenCalledTimes(0);
      expect(rejectStubForTileTasks).toHaveBeenCalledTimes(1);
      expect(rejectStubForTileTasks).toHaveBeenCalledWith(task.jobId, task.id, false);
    });
  });
});
