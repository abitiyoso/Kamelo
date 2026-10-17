import { validateCommand } from "./domain.mjs";
export type Command = { code: string; value: boolean | number };
export type SmartDevice = {
  id: string;
  online: boolean;
  capabilities: Record<string, { type: string; min?: number; max?: number }>;
  state: Record<string, boolean | number>;
};
export interface IoTProvider {
  listDevices(): Promise<SmartDevice[]>;
  getDeviceStatus(id: string): Promise<SmartDevice>;
  getDeviceCapabilities(id: string): Promise<SmartDevice["capabilities"]>;
  sendDeviceCommand(id: string, command: Command): Promise<SmartDevice>;
  syncDevices(): Promise<SmartDevice[]>;
}
export class MockTuyaProvider implements IoTProvider {
  constructor(private devices: SmartDevice[]) {}
  async listDevices() {
    return this.devices;
  }
  async getDeviceStatus(id: string) {
    const d = this.devices.find((d) => d.id === id);
    if (!d) throw new Error("Perangkat tidak ditemukan.");
    return d;
  }
  async getDeviceCapabilities(id: string) {
    return (await this.getDeviceStatus(id)).capabilities;
  }
  async sendDeviceCommand(id: string, command: Command) {
    const d = await this.getDeviceStatus(id);
    validateCommand(d, command);
    d.state = { ...d.state, [command.code]: command.value };
    return d;
  }
  async syncDevices() {
    return this.devices;
  }
}
// Intentionally unavailable until a verified region, linking service and capabilities are supplied.
export class TuyaCloudProvider implements IoTProvider {
  private unavailable(): never {
    throw new Error(
      "Tuya live belum dikonfigurasi dan diverifikasi. Gunakan simulasi.",
    );
  }
  async listDevices(): Promise<SmartDevice[]> {
    return this.unavailable();
  }
  async getDeviceStatus(_id: string): Promise<SmartDevice> {
    return this.unavailable();
  }
  async getDeviceCapabilities(
    _id: string,
  ): Promise<SmartDevice["capabilities"]> {
    return this.unavailable();
  }
  async sendDeviceCommand(
    _id: string,
    _command: Command,
  ): Promise<SmartDevice> {
    return this.unavailable();
  }
  async syncDevices(): Promise<SmartDevice[]> {
    return this.unavailable();
  }
}
