import { ITaskResponse, OperationStatus } from '@map-colonies/mc-priority-queue';

const task: ITaskResponse<unknown> = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  status: OperationStatus.PENDING,
  percentage: 0,
  description: '',
  created: '',
  reason: '',
  updated: '',
  jobId: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
  type: 'testTye',
  attempts: 0,
  parameters: {
    resourceId: 'testId',
    resourceVersion: 'testVersion',
    layerRelativePath: 'testId/testVersion/testProductType',
  },
  resettable: false,
};

function getTask(): ITaskResponse<unknown> {
  return task;
}

export { getTask };
