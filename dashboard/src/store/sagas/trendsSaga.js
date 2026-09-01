import { call, put, takeLatest, select } from 'redux-saga/effects';
import { trendsAPI } from '../../services/api';
import { setTrends, fetchTrends } from '../slices/trendsSlice';

function* fetchTrendsWorker(action) {
  try {
    const window = action.payload;
    const response = yield call(trendsAPI.getTrends, window);
    yield put(setTrends(response.trends));
  } catch (error) {
    console.error('Failed to fetch trends:', error);
    // Could dispatch error action here
  }
}

// Optional: poll trends every minute if needed, but since we get full updates we might just rely on initial load
function* pollTrendsWorker() {
  // Can be implemented if needed
}

export function* trendsSaga() {
  yield takeLatest(fetchTrends.type, fetchTrendsWorker);
}
