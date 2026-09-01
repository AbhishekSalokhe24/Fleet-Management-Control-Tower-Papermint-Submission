import React, { useEffect, useState } from 'react';
import { Drawer, Descriptions, Tag, Spin, Timeline, Progress } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { selectRobot } from '../../store/slices/uiSlice';
import { historyAPI } from '../../services/api';
import { STATUS_CONFIG } from '../../utils/statusConfig';

const RobotDetail = () => {
  const dispatch = useDispatch();
  const selectedRobotId = useSelector(state => state.ui.selectedRobotId);
  const robot = useSelector(state => state.fleet.robots[selectedRobotId]);
  
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRobotId) {
      setLoading(true);
      // Fetch last 5 minutes of history
      const from = Date.now() - 5 * 60 * 1000;
      historyAPI.getHistory(selectedRobotId, from, Date.now())
        .then(res => setHistory(res.events || []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setHistory([]);
    }
  }, [selectedRobotId]);

  if (!selectedRobotId) return null;

  const conf = robot ? STATUS_CONFIG[robot.status] : null;

  return (
    <Drawer
      title={<span>Robot: {selectedRobotId}</span>}
      placement="right"
      onClose={() => dispatch(selectRobot(null))}
      open={!!selectedRobotId}
      width={400}
      bodyStyle={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      headerStyle={{ background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-color)' }}
    >
      {robot ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <Descriptions column={1} bordered size="small" labelStyle={{ color: 'var(--text-secondary)' }} contentStyle={{ color: 'var(--text-primary)' }}>
            <Descriptions.Item label="Type">{robot.robot_type === 'picker' ? 'Picker' : 'Hauler'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {conf && <Tag color={conf.color} variant="solid" style={{ color: 'black' }}>{conf.label}</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Position">
              X: {Math.round(robot.x)} | Y: {Math.round(robot.y)}
            </Descriptions.Item>
            <Descriptions.Item label="Last Seen">
              {new Date(robot.last_seen || Date.now()).toLocaleTimeString()}
            </Descriptions.Item>
            <Descriptions.Item label="Health">
              {robot.stale ? <Tag color="red">Stale / Disconnected</Tag> : <Tag color="green">Live</Tag>}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Battery Level</h4>
            <Progress 
              percent={Math.round(robot.battery)} 
              status={robot.battery < 20 ? 'exception' : 'active'} 
              strokeColor={conf?.color}
            />
          </div>

          <div>
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Recent Status History (5m)</h4>
            {loading ? <Spin /> : (
              <Timeline>
                {/* Deduplicate contiguous statuses to show transitions */}
                {history.reduce((acc, event) => {
                  if (acc.length === 0 || acc[acc.length - 1].status !== event.status) {
                    acc.push(event);
                  }
                  return acc;
                }, []).slice(-5).reverse().map((event, i) => {
                  const eventConf = STATUS_CONFIG[event.status];
                  return (
                    <Timeline.Item key={i} color={eventConf?.color}>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                      {eventConf?.label || event.status}
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            )}
          </div>
        </div>
      ) : (
        <Spin />
      )}
    </Drawer>
  );
};

export default RobotDetail;
