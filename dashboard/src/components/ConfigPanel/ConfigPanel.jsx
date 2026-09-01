import React, { useState } from 'react';
import { Modal, Form, InputNumber, Input, Button, Alert } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { updateConfig } from '../../store/slices/configSlice';

const ConfigPanel = () => {
  const [visible, setVisible] = useState(false);
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { fleetSize, updateIntervalMs, loading, error } = useSelector(state => state.config);

  const showModal = () => {
    form.setFieldsValue({
      FLEET_SIZE: fleetSize,
      UPDATE_INTERVAL_MS: updateIntervalMs,
    });
    setVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(values => {
      const { AUTH_TOKEN, ...data } = values;
      dispatch(updateConfig({ data, token: AUTH_TOKEN }));
      if (!error) {
        setVisible(false);
      }
    });
  };

  return (
    <>
      <Button icon={<SettingOutlined />} onClick={showModal} type="primary" ghost>
        Settings
      </Button>
      <Modal
        title="Fleet Configuration"
        open={visible}
        onOk={handleOk}
        confirmLoading={loading}
        onCancel={() => setVisible(false)}
        okText="Apply Changes"
      >
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        
        <Form form={form} layout="vertical">
          <Form.Item 
            name="FLEET_SIZE" 
            label="Fleet Size" 
            rules={[{ required: true, type: 'number', min: 1, max: 10000 }]}
            extra="Number of active simulated robots"
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item 
            name="UPDATE_INTERVAL_MS" 
            label="Update Interval (ms)" 
            rules={[{ required: true, type: 'number', min: 100, max: 60000 }]}
            extra="Milliseconds between robot ticks"
          >
            <InputNumber style={{ width: '100%' }} step={100} />
          </Form.Item>

          <Form.Item 
            name="AUTH_TOKEN" 
            label="Admin Token" 
            rules={[{ required: true, message: 'Please input admin token' }]}
            extra="Required for runtime configuration changes"
          >
            <Input.Password placeholder="fleet-admin-token" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ConfigPanel;
