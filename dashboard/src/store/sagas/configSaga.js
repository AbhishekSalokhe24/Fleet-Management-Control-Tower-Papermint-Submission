import { call, put, takeLatest } from 'redux-saga/effects';
import { configAPI, fleetAPI } from '../../services/api';
import { 
  setConfig, 
  fetchConfig, 
  updateConfig, 
  updateConfigSuccess, 
  updateConfigFailure 
} from '../slices/configSlice';
import { setFleet, pruneToFleetSize } from '../slices/fleetSlice';

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
    
    if (response.config?.FLEET_SIZE) {
      yield put(pruneToFleetSize(response.config.FLEET_SIZE));
    }

    // Immediately fetch updated fleet state from server
    try {
      const fleetRes = yield call(fleetAPI.getFleet);
      if (fleetRes && fleetRes.robots) {
        yield put(setFleet(fleetRes));
      }
    } catch (e) {
      console.warn('Could not fetch updated fleet after config change:', e);
    }

    yield put(updateConfigSuccess());
  } catch (error) {
    console.error('Failed to update config:', error);
    const msg = error.response?.data?.error || error.message || 'Failed to update config';
    yield put(updateConfigFailure(msg));
  }
}

export function* configSaga() {
  yield takeLatest(fetchConfig.type, fetchConfigWorker);
  yield takeLatest(updateConfig.type, updateConfigWorker);
}
