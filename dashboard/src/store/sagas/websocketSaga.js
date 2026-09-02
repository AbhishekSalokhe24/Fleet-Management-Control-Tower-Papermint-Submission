import { eventChannel, END } from 'redux-saga';
import { call, put, take, fork, delay, cancel } from 'redux-saga/effects';
import { setFleet, updateRobots, pruneToFleetSize, setConnected } from '../slices/fleetSlice';
import { setConfig } from '../slices/configSlice';
import { CONSTANTS } from '../../utils/constants';

function createWebSocketChannel() {
  return eventChannel(emit => {
    let ws;
    let pingInterval;

    const connect = () => {
      ws = new WebSocket(CONSTANTS.WS_URL);

      ws.onopen = () => {
        emit({ type: 'connected', payload: true });
        // Heartbeat
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'snapshot') {
            emit(setFleet(msg));
          } else if (msg.type === 'update') {
            emit(updateRobots(msg));
          } else if (msg.type === 'config_changed') {
            emit(setConfig(msg.config));
            if (msg.config?.FLEET_SIZE) {
              emit(pruneToFleetSize(msg.config.FLEET_SIZE));
            }
          }
        } catch (e) {
          console.error('WS message error:', e);
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        emit({ type: 'connected', payload: false });
        emit(END); // Close channel to trigger reconnect
      };

      ws.onerror = () => {
        // close event will fire next
      };
    };

    connect();

    return () => {
      clearInterval(pingInterval);
      if (ws) ws.close();
    };
  });
}

function* watchWebSocket() {
  while (true) {
    let channel;
    try {
      channel = yield call(createWebSocketChannel);
      
      while (true) {
        const action = yield take(channel);
        if (action.type === 'connected') {
          yield put(setConnected(action.payload));
        } else {
          yield put(action);
        }
      }
    } catch (err) {
      console.error('WS Saga error:', err);
    } finally {
      yield put(setConnected(false));
      if (channel) channel.close();
      // Wait before reconnecting
      yield delay(2000);
    }
  }
}

export function* websocketSaga() {
  yield fork(watchWebSocket);
}
