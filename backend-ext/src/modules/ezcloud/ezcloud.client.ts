/**
 * EZCloud (Uniview) REST API client.
 *
 * Flujo de autenticación:
 *   1. Resolver servidor regional:  POST global.ezcloud.uniview.com/openapi/user/account/server/getbyloginname
 *   2. Login con MD5(password):      POST <server>/openapi/user/account/token/get
 *   3. Usar accessToken en cabecera Authorization para todos los endpoints.
 *
 * No requiere appKey/appSecret — funciona con el correo y contraseña de la app EZView.
 */

import crypto from 'crypto'

interface TokenCache {
  accessToken: string
  expiresAt: number   // epoch ms
  server: string      // servidor regional resuelto
}

export interface EzDevice {
  deviceSerial:   string
  deviceName:     string
  deviceModel:    string
  deviceType:     number  // 0=IPC, 1=NVR, 7=DoorBell
  deviceTypeName: string
  status:         number  // 1=online, 0=offline
  channelNum?:    number
}

interface LoginResponse {
  code:    number
  message: string
  data?: {
    accessToken:    string
    expireTime:     number  // epoch seconds
    serverAddress?: string
    userName?:      string
  }
}

interface ServerResponse {
  code:    number
  message: string
  data?: { serverAddress: string }
}

interface DeviceListResponse {
  code:    number
  message: string
  data?: {
    total:       number
    deviceList?: EzDevice[]
  }
}

interface LiveUrlResponse {
  code:    number
  message: string
  data?: { url?: string; URL?: string; p2pUrl?: string; rtspUrl?: string; flvUrl?: string }
}

interface SnapshotResponse {
  code:    number
  message: string
  data?: { picUrl?: string; imageBase64?: string }
}

const GLOBAL_SERVER = 'global.ezcloud.uniview.com'
const USER_AGENT    = 'UNVDesktop/1.0'

export class EzcloudClient {
  private tokenCache: TokenCache | null = null

  constructor(
    /** Correo de la cuenta EZCloud (app EZView) */
    private readonly username: string,
    /** Contraseña de la cuenta EZCloud */
    private readonly password: string,
    /** No se usa para la resolución del servidor; se mantiene por compatibilidad */
    private readonly _baseUrl: string = `https://${GLOBAL_SERVER}`
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private md5(text: string): string {
    return crypto.createHash('md5').update(text, 'utf8').digest('hex')
  }

  private async post<T>(
    server: string,
    path: string,
    body: Record<string, unknown>,
    accessToken?: string
  ): Promise<T> {
    const url = `https://${server}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent':   USER_AGENT,
    }
    if (accessToken) headers['Authorization'] = accessToken

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`EZCloud HTTP ${res.status} at ${path}`)

    const json = (await res.json()) as T & { code?: number; message?: string }
    const code = (json as any).code
    if (code !== undefined && code !== 200 && code !== 0) {
      throw new Error(`EZCloud API error ${code}: ${(json as any).message || ''}`)
    }
    return json
  }

  // ─── autenticación ──────────────────────────────────────────────────────────

  private async resolveServer(): Promise<string> {
    const resp = await this.post<ServerResponse>(
      GLOBAL_SERVER,
      '/openapi/user/account/server/getbyloginname',
      { loginName: this.username }
    )
    return resp.data?.serverAddress || GLOBAL_SERVER
  }

  async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken
    }

    const server   = await this.resolveServer()
    const md5pass  = this.md5(this.password)

    const resp = await this.post<LoginResponse>(
      server,
      '/openapi/user/account/token/get',
      { username: this.username, password: md5pass }
    )

    const token = resp.data?.accessToken
    if (!token) throw new Error('EZCloud: no accessToken en la respuesta')

    // expireTime es epoch en segundos
    const expireTime = resp.data?.expireTime ?? 7200
    const expiresAt  = expireTime < 1e10
      ? Date.now() + expireTime * 1000
      : expireTime * 1000

    this.tokenCache = {
      accessToken: token,
      expiresAt,
      server: resp.data?.serverAddress || server,
    }
    return token
  }

  private async getServer(): Promise<string> {
    await this.getToken()  // asegura que tokenCache esté poblado
    return this.tokenCache!.server
  }

  // ─── dispositivos ────────────────────────────────────────────────────────────

  async listDevices(): Promise<EzDevice[]> {
    const [accessToken, server] = await Promise.all([this.getToken(), this.getServer()])
    const devices: EzDevice[] = []
    let pageNum  = 1
    const pageSize = 100

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const resp = await this.post<DeviceListResponse>(
        server,
        '/openapi/device/list',
        { pageNum, pageSize },
        accessToken
      )
      const list = resp.data?.deviceList ?? []
      devices.push(...list)
      if (list.length < pageSize) break
      pageNum++
    }
    return devices
  }

  // ─── stream en vivo ──────────────────────────────────────────────────────────

  async getLiveUrl(serial: string, channelNo: number | string = 0): Promise<string> {
    const [accessToken, server] = await Promise.all([this.getToken(), this.getServer()])

    // Probar protocol 0 (P2P) y 1 (relay) hasta obtener URL
    for (const protocol of [0, 1, 2]) {
      const resp = await this.post<LiveUrlResponse>(
        server,
        '/openapi/device/media/url/get',
        {
          deviceSerial: serial,
          channelNo:    Number(channelNo),
          quality:      0,
          protocol,
        },
        accessToken
      ).catch(() => null)

      const d   = resp?.data
      const url = d?.URL || d?.url || d?.p2pUrl || d?.rtspUrl || d?.flvUrl
      if (url) return url
    }
    throw new Error(`EZCloud: no se encontró URL de stream para ${serial}`)
  }

  // ─── snapshot ───────────────────────────────────────────────────────────────

  async captureSnapshot(serial: string, channelNo: number | string = 0): Promise<string> {
    const [accessToken, server] = await Promise.all([this.getToken(), this.getServer()])
    const resp = await this.post<SnapshotResponse>(
      server,
      '/openapi/device/capture',
      { deviceSerial: serial, channelNo: Number(channelNo) },
      accessToken
    )
    const url = resp.data?.picUrl
    if (!url) throw new Error(`EZCloud: no snapshot URL para ${serial}`)
    return url
  }
}
