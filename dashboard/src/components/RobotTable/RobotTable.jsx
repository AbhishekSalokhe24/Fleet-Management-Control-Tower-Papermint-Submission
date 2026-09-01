import React, { useMemo } from 'react';
import { Table, Tag, Input, Select, Progress } from 'antd';
import { useSelector, useDispatch } from 'react-redux';
import { selectRobot, setSearchQuery, setStatusFilter } from '../../store/slices/uiSlice';
import { STATUS_CONFIG } from '../../utils/statusConfig';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;

const RobotTable = () => {
  const robots = useSelector(state => state.fleet.robots);
  const { searchQuery, statusFilter, selectedRobotId } = useSelector(state => state.ui);
  const dispatch = useDispatch();

  const data = useMemo(() => {
    let filtered = Object.values(robots);
    
    if (searchQuery) {
      filtered = filtered.filter(r => r.robot_id.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    if (statusFilter.length > 0) {
      filtered = filtered.filter(r => statusFilter.includes(r.status));
    }
    
    return filtered.map(r => ({ ...r, key: r.robot_id }));
  }, [robots, searchQuery, statusFilter]);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'robot_id',
      key: 'robot_id',
      sorter: (a, b) => a.robot_id.localeCompare(b.robot_id),
      render: text => <strong>{text}</strong>,
    },
    {
      title: 'Type',
      dataIndex: 'robot_type',
      key: 'robot_type',
      render: (type) => type === 'picker' ? 'Picker' : 'Hauler',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status) => {
        const conf = STATUS_CONFIG[status] || { color: '#ccc', label: status };
        return <Tag color={conf.color} variant="solid" style={{ color: 'black' }}>{conf.label}</Tag>;
      }
    },
    {
      title: 'Battery',
      dataIndex: 'battery',
      key: 'battery',
      sorter: (a, b) => a.battery - b.battery,
      render: (val) => {
        let status = 'normal';
        if (val < 20) status = 'exception';
        else if (val > 80) status = 'success';
        return <Progress percent={Math.round(val)} size="small" status={status} />;
      }
    },
    {
      title: 'Position',
      key: 'position',
      render: (_, r) => `(${Math.round(r.x)}, ${Math.round(r.y)})`,
    },
    {
      title: 'Health',
      dataIndex: 'stale',
      key: 'stale',
      render: (stale) => stale ? <Tag color="red">Stale</Tag> : <Tag color="green">Live</Tag>,
    }
  ];

  return (
    <div className="panel" style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <Input 
          placeholder="Search Robot ID..." 
          prefix={<SearchOutlined />} 
          value={searchQuery}
          onChange={e => dispatch(setSearchQuery(e.target.value))}
          style={{ width: 250 }}
        />
        <Select
          mode="multiple"
          placeholder="Filter by Status"
          style={{ width: 300 }}
          value={statusFilter}
          onChange={val => dispatch(setStatusFilter(val))}
          allowClear
        >
          {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
            <Option key={key} value={key}>
              <Tag color={conf.color} variant="solid" style={{ color: 'black' }}>{conf.label}</Tag>
            </Option>
          ))}
        </Select>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        size="middle"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '50', '100'] }}
        rowClassName={record => record.robot_id === selectedRobotId ? 'ant-table-row-selected' : ''}
        onRow={(record) => {
          return {
            onClick: () => {
              dispatch(selectRobot(record.robot_id === selectedRobotId ? null : record.robot_id));
            },
            style: { cursor: 'pointer' }
          };
        }}
        scroll={{ y: 400 }}
      />
    </div>
  );
};

export default RobotTable;
