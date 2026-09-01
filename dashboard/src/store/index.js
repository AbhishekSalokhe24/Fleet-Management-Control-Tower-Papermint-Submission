import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import fleetReducer from './slices/fleetSlice';
import trendsReducer from './slices/trendsSlice';
import uiReducer from './slices/uiSlice';
import configReducer from './slices/configSlice';
import rootSaga from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    fleet: fleetReducer,
    trends: trendsReducer,
    ui: uiReducer,
    config: configReducer,
  },
  middleware: (getDefaultMiddleware) => 
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
});

sagaMiddleware.run(rootSaga);
