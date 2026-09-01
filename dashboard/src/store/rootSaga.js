import { all, fork } from 'redux-saga/effects';
import { websocketSaga } from './sagas/websocketSaga';
import { trendsSaga } from './sagas/trendsSaga';
import { configSaga } from './sagas/configSaga';

export default function* rootSaga() {
  yield all([
    fork(websocketSaga),
    fork(trendsSaga),
    fork(configSaga),
  ]);
}
