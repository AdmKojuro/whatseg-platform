/**
 * EZCloud (Uniview) Open Platform API client.
 * Requires appKey + appSecret from https://global-open.uniview.com (Unisee portal).
 */

interface TokenCache {
  accessToken: string
  expiresAt: number // epoch ms
}

interface EzDevice {
  deviceSerial: string
  deviceName: string
  status: number // 1=online, 0=offline
  channelNum: number
}

interface TokenResponse {
  code: string
  msg: string
  data?: {
    accessToken: string
    expireTime?: number // seconds until expiry, or epoch
  }
}

interface DeviceListResponse {
  code: string
  msg: string
  data?: {
    total: number
    deviceInfoList?: EzDevice[]
    list?: EzDevice[]           // some API versions use "list"
  }
}

interface LiveUrlResponse {
  code: string
  msg: string
  data?: { url: string; hls?: string }
}

interface SnapshotResponse {
  code: string
  msg: string
  data?: { picUrl: string; imageBase64?: string }
}

export class EzcloudClient {
  private tokenCache: TokenCache | null = null

  constructor(
    private readonly appKey: string,
    private readonly appSecret: string,
    private readonly baseUrl: string = 'https://open.ezcloud.uniview.com'
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`EZCloud HTTP ${res.status} at ${path}`)
    const json = (await res.json()) as T & { code?: string; msg?: string }
    if ((json as any).code && (json as any).code !== '200' && (json as any).code !== '0') {
      throw new Error(`EZCloud API error ${(json as any).code}: ${(json as any).msg}`)
    }
    return json
  }

  // ─── token ──────────────────────────────────────────────────────────────────

  async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken
    }
    const resp = await this.post<TokenResponse>('/api/lapp/token/get', {
      appKey: this.appKey,
      appSecret: this.appSecret,
    })
    const token = resp.data?.accessToken
    if (!token) throw new Error('EZCloud: no accessToken in response')

    // expireTime may be seconds-from-now or epoch; treat values < 1e10 as seconds
    const expireTime = resp.data?.expireTime ?? 7200
    const expiresAt = expireTime < 1e10 ? Date.now() + expireTime * 1000 : expireTime * 1000

    this.tokenCache = { accessToken: token, expiresAt }
    return token
  }

  // ─── device list ────────────────────────────────────────────────────────────

  async listDevices(): Promise<EzDevice[]> {
    const accessToken = await this.getToken()
    const devices: EzDevice[] = []
    let pageStart = 0
    const pageSize = 50

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const resp = await this.post<DeviceListResponse>('/api/lapp/device/list', {
        accessToken,
        pageStart,
        pageSize,
      })
      const list = resp.data?.deviceInfoList ?? resp.data?.list ?? []
      devices.push(...list)
      if (list.length < pageSize) break
      pageStart += pageSize
    }
    return devices
  }

  // ─── live URL ───────────────────────────────────────────────────────────────

  async getLiveUrl(serial: string, channel = '1'): Promise<string> {
    const accessToken = await this.getToken()
    const resp = await this.post<LiveUrlResponse>('/api/lapp/live/address/get', {
      accessToken,
      deviceSerial: serial,
      channelNo: channel,
    })
    const url = resp.data?.url ?? resp.data?.hls
    if (!url) throw new Error(`EZCloud: no live URL for ${serial}`)
    return url
  }

  // ─── snapshot ───────────────────────────────────────────────────────────────

  async captureSnapshot(serial: string, channel = '1'): Promise<string> {
    const accessToken = await this.getToken()
    const resp = await this.post<SnapshotResponse>('/api/lapp/device/capture', {
      accessToken,
      deviceSerial: serial,
      channelNo: channel,
    })
    const url = resp.data?.picUrl
    if (!url) throw new Error(`EZCloud: no snapshot URL for ${serial}`)
    return url
  }
}
