export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let deviceId = localStorage.getItem('device_id');

  if (!deviceId) {
    // Generate a random device ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('device_id', deviceId);
  }

  return deviceId;
}
