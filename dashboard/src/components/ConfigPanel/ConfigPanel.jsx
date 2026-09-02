import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Input, Button, Alert, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { updateConfig } from '../../store/slices/configSlice';

const DEFAULT_AUTH_TOKEN = 'uJ0FEfjjGJ90yOok6ns5SNlQnI7DPJ6_97KrFweGi4g';

const ConfigPanel = () => {
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { fleetSize, updateIntervalMs, loading, error } = useSelector(state => state.config);

  const showModal = () => {
    const savedToken = localStorage.getItem('fleet_admin_token') || DEFAULT_AUTH_TOKEN;
    form.setFieldsValue({
      FLEET_SIZE: fleetSize,
      UPDATE_INTERVAL_MS: updateIntervalMs,
      AUTH_TOKEN: savedToken,
    });
    setVisible(true);
  };

  // Only close modal when async update finishes successfully
  useEffect(() => {
    if (submitting && !loading) {
      setSubmitting(false);
      if (!error) {
        message.success('Fleet configuration updated successfully!');
        setVisible(false);
      }
    }
  }, [loading, error, submitting]);

  const handleOk = () => {
    form.validateFields().then(values => {
      const { AUTH_TOKEN, ...data } = values;
      localStorage.setItem('fleet_admin_token', AUTH_TOKEN);
      setSubmitting(true);
      dispatch(updateConfig({ data, token: AUTH_TOKEN }));
    }).catch(err => {
      console.warn('Form validation failed:', err);
    });
  };

  return (
    <>
      <Button icon={<SettingOutlined />} onClick={showModal} type="primary" ghost>
        Fleet Configuration
      </Button>
      <Modal
        title="Fleet Configuration"
        open={visible}
        onOk={handleOk}
        confirmLoading={loading}
        onCancel={() => {
          setSubmitting(false);
          setVisible(false);
        }}
        okText="Apply Changes"
      >
        {error && (
          <Alert 
            message="Configuration Error" 
            description={error} 
            type="error" 
            showIcon 
            style={{ marginBottom: 16 }} 
          />
        )}
        
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
            extra="Milliseconds between robot telemetry ticks"
          >
            <InputNumber style={{ width: '100%' }} step={100} />
          </Form.Item>

          <Form.Item 
            name="AUTH_TOKEN" 
            label="Admin Token" 
            rules={[{ required: true, message: 'Please input admin token' }]}
            extra="Pre-filled with default token for authorization"
          >
            <Input.Password placeholder="fleet-admin-token" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ConfigPanel;
