import { call, put, takeLatest } from 'redux-saga/effects';
import { configAPI } from '../../services/api';
import { 
  setConfig, 
  fetchConfig, 
  updateConfig, 
  updateConfigSuccess, 
  updateConfigFailure 
} from '../slices/configSlice';

function* fetchConfigWorker() {
  try {
    const response = yield call(configAPI.getConfig);
    yield put(setConfig(response.config));
  } catch (error) {
    console.error('Failed to fetch config:', error);
  }
}

function* updateConfigWorker(action) {
  try {
    const { data, token } = action.payload;
    const response = yield call(configAPI.updateConfig, data, token);
    yield put(setConfig(response.config));
    yield put(updateConfigSuccess());
  } catch (error) {
    console.error('Failed to update config:', error);
    const msg = error.response?.data?.error || 'Failed to update config';
    yield put(updateConfigFailure(msg));
  }
}

export function* configSaga() {
  yield takeLatest(fetchConfig.type, fetchConfigWorker);
  yield takeLatest(updateConfig.type, updateConfigWorker);
}
