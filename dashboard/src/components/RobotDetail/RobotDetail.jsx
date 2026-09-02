import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Drawer, Descriptions, Tag, Spin, Timeline, Progress, Empty } from 'antd';
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

  const fetchHistory = useCallback((isPolling = false) => {
    if (!selectedRobotId) return;
    if (!isPolling) setLoading(true);

    // Query last 15 minutes, or fallback to all available events if window has 0
    const from = Date.now() - 15 * 60 * 1000;
    historyAPI.getHistory(selectedRobotId, from, Date.now())
      .then(res => {
        const events = res?.events || [];
        if (events.length === 0) {
          // If 15-minute window is empty, query all available events for this robot
          return historyAPI.getHistory(selectedRobotId, 0, Date.now()).then(allRes => {
            setHistory(allRes?.events || []);
          });
        }
        setHistory(events);
      })
      .catch(err => {
        console.error('Failed to fetch robot history:', err);
      })
      .finally(() => {
        if (!isPolling) setLoading(false);
      });
  }, [selectedRobotId]);

  useEffect(() => {
    if (selectedRobotId) {
      fetchHistory(false);
      // Auto-refresh history every 4 seconds while drawer is open
      const timer = setInterval(() => {
        fetchHistory(true);
      }, 4000);
      return () => clearInterval(timer);
    } else {
      setHistory([]);
    }
  }, [selectedRobotId, fetchHistory]);

  const conf = robot ? STATUS_CONFIG[robot.status] : null;
  const isPicker = robot?.robot_type === 'picker';
  const robotImage = isPicker ? '/forklift_side_view.png' : '/hauler_side_view.png';
  const typeLabel = isPicker ? 'Forklift (Picker)' : 'Hauler';

  // Compute timeline items using Ant Design 5/6 standard `items` prop
  const timelineItems = useMemo(() => {
    if (!history || history.length === 0) {
      if (robot) {
        return [{
          color: conf?.color || 'blue',
          children: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Tag color={conf?.color} style={{ color: '#000', fontWeight: 600, fontSize: '11px', marginRight: '6px' }}>
                  {conf?.label || robot.status}
                </Tag>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Current State</span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {new Date(robot.last_seen || Date.now()).toLocaleTimeString()}
              </span>
            </div>
          )
        }];
      }
      return [];
    }

    // Deduplicate contiguous statuses to highlight transitions
    const transitions = history.reduce((acc, event) => {
      if (acc.length === 0 || acc[acc.length - 1].status !== event.status) {
        acc.push(event);
      }
      return acc;
    }, []);

    // Show up to last 8 status transitions, newest first
    return transitions.slice(-8).reverse().map((event, idx) => {
      const eventConf = STATUS_CONFIG[event.status];
      const isLatest = idx === 0;
      return {
        key: event.id || idx,
        color: eventConf?.color || 'blue',
        children: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Tag 
                color={eventConf?.color} 
                style={{ 
                  color: '#000', 
                  fontWeight: 600, 
                  fontSize: '11px', 
                  marginRight: '6px',
                  border: isLatest ? '1px solid #ffffff' : 'none'
                }}
              >
                {eventConf?.label || event.status}
              </Tag>
              {isLatest && (
                <span style={{ fontSize: '10px', color: 'var(--color-active)', fontWeight: 600, marginRight: '4px' }}>
                  ● LIVE
                </span>
              )}
              {event.taskEvent && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  ({event.taskEvent})
                </span>
              )}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )
      };
    });
  }, [history, robot, conf]);

  if (!selectedRobotId) return null;

  return (
    <Drawer
      title={<span>Robot: {selectedRobotId}</span>}
      placement="right"
      onClose={() => dispatch(selectRobot(null))}
      open={!!selectedRobotId}
      width={420}
      styles={{
        body: { background: 'var(--bg-panel)', color: 'var(--text-primary)' },
        header: { background: 'var(--bg-dark)', borderBottom: '1px solid var(--border-color)' }
      }}
    >
      {robot ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Side View Showcase Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '16px 20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <img 
              src={robotImage} 
              alt={typeLabel} 
              style={{ 
                maxHeight: '95px', 
                maxWidth: '180px', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.45))'
              }} 
            />
            <div style={{ 
              marginTop: '10px', 
              fontSize: '12px', 
              color: 'var(--text-secondary)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{typeLabel}</span>
              <span>•</span>
              <span style={{ color: conf?.color || '#fff' }}>{conf?.label || robot.status}</span>
            </div>
          </div>

          <Descriptions column={1} bordered size="small" labelStyle={{ color: 'var(--text-secondary)' }} contentStyle={{ color: 'var(--text-primary)' }}>
            <Descriptions.Item label="Type">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>{typeLabel}</span>
              </div>
            </Descriptions.Item>
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
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px' }}>Battery Level</h4>
            <Progress 
              percent={Math.round(robot.battery)} 
              status={robot.battery < 20 ? 'exception' : 'active'} 
              strokeColor={conf?.color}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>
                Recent Status History
              </h4>
              {loading && <Spin size="small" />}
            </div>

            {timelineItems.length > 0 ? (
              <Timeline items={timelineItems} />
            ) : (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description={<span style={{ color: 'var(--text-secondary)' }}>No status history recorded yet</span>} 
              />
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
