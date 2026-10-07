import api from './api'
import type { MqttDriver, MqttDevice, RegisterMqttDeviceInput, BrokerStatus } from '../types/mqtt'

export const mqttService = {
  getDrivers: () => api.get<MqttDriver[]>('/mqtt-devices/drivers'),
  getDevices: () => api.get<MqttDevice[]>('/mqtt-devices/devices'),
  register: (data: RegisterMqttDeviceInput) => api.post('/mqtt-devices/devices', data),
  delete: (kind: string, deviceId: string) => api.delete(`/mqtt-devices/devices/${kind}:${deviceId}`),
  getBrokerStatus: () => api.get<BrokerStatus>('/mqtt-devices/broker/status'),
}
