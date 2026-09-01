import React from 'react';
import { Row, Col, Statistic, Card } from 'antd';
import { useSelector } from 'react-redux';
import { CheckCircleOutlined, SyncOutlined, WarningOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';

const FleetKPIBar = () => {
  const summary = useSelector(state => state.fleet.summary);

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic title="Total Robots" value={summary.total} prefix={<CheckCircleOutlined />} />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic 
            title="Working" 
            value={summary.working} 
            valueStyle={{ color: '#52c41a' }}
            prefix={<SyncOutlined spin={summary.working > 0} />} 
            suffix={`(${summary.total ? Math.round(summary.working/summary.total*100) : 0}%)`}
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic 
            title="Attention" 
            value={summary.attention} 
            valueStyle={{ color: '#fa8c16' }}
            prefix={<WarningOutlined />} 
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic 
            title="Critical" 
            value={summary.critical} 
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<StopOutlined />} 
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic 
            title="Avg Battery" 
            value={summary.avgBattery} 
            precision={1}
            suffix="%"
            prefix={<ThunderboltOutlined />} 
            valueStyle={{ color: summary.avgBattery < 30 ? '#faad14' : 'inherit' }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} lg={4}>
        <Card bordered={false} className="panel" bodyStyle={{ padding: '0 16px' }}>
          <Statistic 
            title="Low Battery (<20%)" 
            value={summary.lowBattery} 
            valueStyle={{ color: summary.lowBattery > 0 ? '#ff4d4f' : 'inherit' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default FleetKPIBar;
