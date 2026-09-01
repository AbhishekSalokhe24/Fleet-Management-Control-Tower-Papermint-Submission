import React, { useEffect } from 'react';
import { Layout, Typography } from 'antd';
import { useDispatch } from 'react-redux';
import { fetchConfig } from './store/slices/configSlice';
import SiteMap from './components/SiteMap/SiteMap';
import FleetKPIBar from './components/FleetKPIBar/FleetKPIBar';
import ConnectionStatus from './components/ConnectionStatus/ConnectionStatus';

// We'll import other components later
import TrendChart from './components/TrendChart/TrendChart';
import RobotTable from './components/RobotTable/RobotTable';
import RobotDetail from './components/RobotDetail/RobotDetail';
import ConfigPanel from './components/ConfigPanel/ConfigPanel';

const { Header, Content } = Layout;
const { Title } = Typography;

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchConfig());
  }, [dispatch]);

  return (
    <Layout className="dashboard-layout">
      <Header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'white', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/peppermint_robotics.png" alt="Peppermint Robotics" style={{ height: '32px' }} />
          </div>
          <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
            Fleet Management Control Tower
          </Title>
        </div>
        <div className="header-controls">
          <ConnectionStatus />
          <ConfigPanel />
        </div>
      </Header>
      <Content className="dashboard-content">
        <FleetKPIBar />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <SiteMap />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TrendChart />
          </div>
        </div>
        <RobotTable />
        <RobotDetail />
      </Content>
    </Layout>
  );
};

export default App;
