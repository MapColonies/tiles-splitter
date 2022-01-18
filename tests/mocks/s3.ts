const getS3ObjectPromiseMock = jest.fn();
const getS3ObjectCreateReadStreamMock = jest.fn();
const getS3ObjectMock = jest.fn();

const headObjectPromiseMock = jest.fn();
const headObjectMock = jest.fn();

const listObjectsV2PromiseMock = jest.fn();
const listObjectsV2Mock = jest.fn();

const deleteObjectsPromiseMock = jest.fn();
const deleteObjectsMock = jest.fn();

const s3Mock = {
  listObjectsV2: listObjectsV2Mock,
  deleteObjects: deleteObjectsMock,
  getObject: getS3ObjectMock,
  headObject: headObjectMock,
};

const initS3Mock = (): void => {
  listObjectsV2Mock.mockReturnValue({
    promise: listObjectsV2PromiseMock,
  });
  deleteObjectsMock.mockReturnValue({
    promise: deleteObjectsPromiseMock,
  });

  getS3ObjectMock.mockReturnValue({
    promise: getS3ObjectPromiseMock,
    createReadStream: getS3ObjectCreateReadStreamMock,
  });

  headObjectMock.mockReturnValue({
    promise: headObjectPromiseMock,
  });
};

export {
  s3Mock,
  initS3Mock,
  listObjectsV2PromiseMock,
  listObjectsV2Mock,
  deleteObjectsPromiseMock,
  deleteObjectsMock,
  getS3ObjectMock,
  getS3ObjectPromiseMock,
  getS3ObjectCreateReadStreamMock,
  headObjectMock,
  headObjectPromiseMock,
};
