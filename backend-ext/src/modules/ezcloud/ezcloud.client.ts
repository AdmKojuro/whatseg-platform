/**
 * EZCloud (Uniview) Open Platform API client.
 * Authenticates with appId + secretKey (from EZCloud portal → My App).
 * Base URL: https://os.ezcloud.uniview.com
 * Docs: /openapi/user/app/token/get  (code 200 = success)
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
  code: number | string
  message: string
  data?: {
    accessToken: string
    expireTime?: number // UTC timestamp in seconds
  }
}

interface DeviceListResponse {
  code: number | string
  message: string
  data?: {
    total: number
    deviceList?: EzDevice[]
    list?: EzDevice[]
  }
}

interface LiveUrlResponse {
  code: number | string
  message: string
  data?: { url?: string; p2pUrl?: string; hls?: string }
}

interface SnapshotResponse {
  code: number | string
  message: string
  data?: { picUrl?: string; imageBase64?: string }
}

export class EzcloudClient {
  private tokenCache: TokenCache | null = null

  constructor(
    /** Application ID — desde el portal EZCloud → Mi App */
    private readonly appId: string,
    /** Secret Key — desde el portal EZCloud → Mi App → ver secretKey */
    private readonly secretKey: string,
    private readonly baseUrl: string = 'https://os.ezcloud.uniview.com'
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = accessToken

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`EZCloud HTTP ${res.status} at ${path}`)

    const json = (await res.json()) as T & { code?: number | string; message?: string; msg?: string }
    const code = (json as any).code
    // Success codes: 200 (documented) or 0 (some endpoints)
    if (code !== undefined && code !== 200 && code !== '200' && code !== 0 && code !== '0') {
      const msg = (json as any).message || (json as any).msg || ''
      throw new Error(`EZCloud API error ${code}: ${msg}`)
    }
    return json
  }

  // ─── token ──────────────────────────────────────────────────────────────────

  async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken
    }
    const resp = await this.post<TokenResponse>('/openapi/user/app/token/get', {
      appId:     this.appId,
      secretKey: this.secretKey,
    })
    const token = resp.data?.accessToken
    if (!token) throw new Error('EZCloud: no accessToken in response')

    // expireTime is a UTC timestamp in seconds
    const expireTime = resp.data?.expireTime ?? 7200
    const expiresAt = expireTime < 1e10
      ? Date.now() + expireTime * 1000   // relative seconds
      : expireTime * 1000                // absolute epoch seconds

    this.tokenCache = { accessToken: token, expiresAt }
    return token
  }

  // ─── device list ────────────────────────────────────────────────────────────

  async listDevices(): Promise<EzDevice[]> {
    const accessToken = await this.getToken()
    const devices: EzDevice[] = []
    let pageNo = 1
    const pageSize = 50

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const resp = await this.post<DeviceListResponse>(
        '/openapi/device/list',
        { pageNo, pageSize },
        accessToken
      )
      const list = resp.data?.deviceList ?? resp.data?.list ?? []
      devices.push(...list)
      if (list.length < pageSize) break
      pageNo++
    }
    return devices
  }

  // ─── live URL ───────────────────────────────────────────────────────────────

  async getLiveUrl(serial: string, channelNo: number | string = 0): Promise<string> {
    const accessToken = await this.getToken()
    const resp = await this.post<LiveUrlResponse>(
      '/openapi/device/media/url/get',
      {
        deviceSerial: serial,
        channelNo:    Number(channelNo),
        quality:      0,
        protocol:     0,
      },
      accessToken
    )
    const url = resp.data?.url ?? resp.data?.p2pUrl ?? resp.data?.hls
    if (!url) throw new Error(`EZCloud: no live URL for ${serial}`)
    return url
  }

  // ─── snapshot ───────────────────────────────────────────────────────────────

  async captureSnapshot(serial: string, channelNo: number | string = 0): Promise<string> {
    const accessToken = await this.getToken()
    const resp = await this.post<SnapshotResponse>(
      '/openapi/device/capture',
      { deviceSerial: serial, channelNo: Number(channelNo) },
      accessToken
    )
    const url = resp.data?.picUrl
    if (!url) throw new Error(`EZCloud: no snapshot URL for ${serial}`)
    return url
  }
}
