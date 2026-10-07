import { useState, useEffect, useRef, useCallback } from 'react'
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, AlertTriangle, Shield, Radio } from 'lucide-react'
import { STORAGE_KEYS } from '../../config/constants'

interface Peer {
  id: string
  name: string
  stream?: MediaStream
  pc?: RTCPeerConnection
}

interface SignalMsg {
  type: 'join' | 'leave' | 'offer' | 'answer' | 'ice' | 'peers'
  room_id?: string
  user_id?: string
  user_name?: string
  to?: string
  from?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  peers?: { id: string; name: string }[]
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const ROOM_ID = 'crisis-room-central'

export default function CrisisPage() {
  const [inRoom, setInRoom] = useState(false)
  const [peers, setPeers] = useState<Peer[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [videoOn, setVideoOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [nivelAlerta, setNivelAlerta] = useState<'NORMAL' | 'ELEVADO' | 'CRITICO'>('NORMAL')

  const wsRef = useRef<WebSocket | null>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const userIdRef = useRef<string>(`u_${Date.now()}`)
  const userNameRef = useRef<string>('Operador')

  // Read user name from token/storage if available
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        userNameRef.current = payload.nombre || payload.email || 'Operador'
        userIdRef.current = payload.sub || userIdRef.current
      } catch { /* use defaults */ }
    }
  }, [])

  const sendSignal = useCallback((msg: SignalMsg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const createPeerConnection = useCallback((peerId: string, peerName: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({ type: 'ice', to: peerId, from: userIdRef.current, candidate: e.candidate.toJSON() })
      }
    }

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0]
      setPeers(prev => prev.map(p =>
        p.id === peerId ? { ...p, stream: remoteStream } : p
      ))
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPeers(prev => prev.filter(p => p.id !== peerId))
        pcsRef.current.delete(peerId)
      }
    }

    pcsRef.current.set(peerId, pc)
    setPeers(prev => {
      const exists = prev.find(p => p.id === peerId)
      if (exists) return prev
      return [...prev, { id: peerId, name: peerName }]
    })
    return pc
  }, [sendSignal])

  const handleSignalMessage = useCallback(async (msg: SignalMsg, stream: MediaStream) => {
    if (!msg.from) return

    if (msg.type === 'peers' && msg.peers) {
      for (const peer of msg.peers) {
        if (peer.id === userIdRef.current) continue
        const pc = createPeerConnection(peer.id, peer.name, stream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        sendSignal({ type: 'offer', to: peer.id, from: userIdRef.current, sdp: offer })
      }
    }

    if (msg.type === 'offer' && msg.sdp) {
      const pc = createPeerConnection(msg.from, msg.user_name || msg.from, stream)
      await pc.setRemoteDescription(msg.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendSignal({ type: 'answer', to: msg.from, from: userIdRef.current, sdp: answer })
    }

    if (msg.type === 'answer' && msg.sdp) {
      const pc = pcsRef.current.get(msg.from)
      if (pc) await pc.setRemoteDescription(msg.sdp)
    }

    if (msg.type === 'ice' && msg.candidate) {
      const pc = pcsRef.current.get(msg.from)
      if (pc) await pc.addIceCandidate(msg.candidate)
    }

    if (msg.type === 'leave') {
      const pc = pcsRef.current.get(msg.from)
      pc?.close()
      pcsRef.current.delete(msg.from)
      setPeers(prev => prev.filter(p => p.id !== msg.from))
    }
  }, [createPeerConnection, sendSignal])

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setLocalStream(stream)
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const wsBase = (import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.hostname}:3068`).replace('http', 'ws')
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || ''
      const ws = new WebSocket(`${wsBase}/ws/crisis?token=${token}`)
      wsRef.current = ws
      setWsStatus('connecting')

      ws.onopen = () => {
        setWsStatus('connected')
        setInRoom(true)
        sendSignal({
          type: 'join',
          room_id: ROOM_ID,
          user_id: userIdRef.current,
          user_name: userNameRef.current,
        })
      }

      ws.onmessage = async (e) => {
        try {
          const msg: SignalMsg = JSON.parse(e.data)
          await handleSignalMessage(msg, stream)
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
      }
    } catch (err) {
      console.error('Error al acceder a cámara/micrófono:', err)
    }
  }

  const leaveRoom = () => {
    sendSignal({ type: 'leave', room_id: ROOM_ID, from: userIdRef.current })
    wsRef.current?.close()
    localStream?.getTracks().forEach(t => t.stop())
    pcsRef.current.forEach(pc => pc.close())
    pcsRef.current.clear()
    setLocalStream(null)
    setPeers([])
    setInRoom(false)
    setWsStatus('disconnected')
  }

  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setVideoOn(v => !v)
  }

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setMicOn(m => !m)
  }

  useEffect(() => {
    return () => { if (inRoom) leaveRoom() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alertColors = {
    NORMAL: 'bg-green-500/20 border-green-500/30 text-green-400',
    ELEVADO: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
    CRITICO: 'bg-red-500/20 border-red-500/30 text-red-400',
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20"><Shield className="text-red-400" size={24} /></div>
          <div>
            <h1 className="text-xl font-semibold text-white">Sala de Crisis Virtual</h1>
            <p className="text-sm text-gray-400">Video conferencia segura P2P · Comando de incidente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${wsStatus === 'connected' ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {wsStatus === 'connected' ? 'Sala activa' : wsStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </div>
        </div>
      </div>

      {/* Nivel de alerta */}
      <div className="flex items-center gap-3">
        <Radio size={14} className="text-gray-400" />
        <span className="text-xs text-gray-400">Nivel de alerta:</span>
        {(['NORMAL', 'ELEVADO', 'CRITICO'] as const).map(nivel => (
          <button
            key={nivel}
            onClick={() => setNivelAlerta(nivel)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${nivelAlerta === nivel ? alertColors[nivel] : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'}`}
          >
            {nivel}
          </button>
        ))}
        {nivelAlerta === 'CRITICO' && (
          <span className="flex items-center gap-1 text-xs text-red-400 animate-pulse">
            <AlertTriangle size={12} /> ALERTA MÁXIMA ACTIVADA
          </span>
        )}
      </div>

      {!inRoom ? (
        /* Pantalla de espera */
        <div className="flex flex-col items-center justify-center py-24 space-y-6">
          <div className="p-6 rounded-full bg-red-500/10 border border-red-500/30">
            <Video className="text-red-400" size={48} />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold text-white">Sala de Crisis — Acceso Restringido</h2>
            <p className="text-sm text-gray-400 max-w-md">
              Videoconferencia P2P cifrada de extremo a extremo. Sin servidor de medios.
              Solo participantes autorizados con acceso a este panel.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users size={12} />
            <span>Tecnología WebRTC — sin grabación en servidor</span>
          </div>
          <button
            onClick={joinRoom}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
          >
            <Video size={18} /> Unirse a la Sala de Crisis
          </button>
        </div>
      ) : (
        /* Grid de video */
        <div className="space-y-4">
          <div className={`grid gap-3 ${peers.length === 0 ? 'grid-cols-1' : peers.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {/* Video local */}
            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video border border-gray-700">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!videoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <VideoOff className="text-gray-400" size={40} />
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                  {userNameRef.current} (Yo)
                </span>
                {!micOn && <MicOff size={12} className="text-red-400" />}
              </div>
            </div>

            {/* Videos de peers */}
            {peers.map(peer => (
              <PeerVideo key={peer.id} peer={peer} />
            ))}

            {/* Esperando participantes */}
            {peers.length === 0 && (
              <div className="bg-gray-800/50 rounded-xl aspect-video border border-dashed border-gray-700 flex flex-col items-center justify-center gap-3">
                <Users className="text-gray-400" size={32} />
                <p className="text-sm text-gray-500">Esperando otros participantes...</p>
                <p className="text-xs text-gray-400">Sala: {ROOM_ID}</p>
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition-all ${micOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              title={micOn ? 'Silenciar' : 'Activar micrófono'}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all ${videoOn ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
              title={videoOn ? 'Apagar cámara' : 'Encender cámara'}
            >
              {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            <button
              onClick={leaveRoom}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
              title="Salir de la sala"
            >
              <PhoneOff size={20} />
            </button>
          </div>

          {/* Info sala */}
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Users size={10} /> {peers.length + 1} participante(s)</span>
            <span>·</span>
            <span>WebRTC P2P · Sin grabación</span>
            <span>·</span>
            <span className={`font-bold ${nivelAlerta === 'CRITICO' ? 'text-red-400' : nivelAlerta === 'ELEVADO' ? 'text-yellow-400' : 'text-green-400'}`}>
              Nivel {nivelAlerta}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function PeerVideo({ peer }: { peer: Peer }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream
    }
  }, [peer.stream])

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video border border-gray-700">
      {peer.stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
              <Users className="text-gray-500" size={24} />
            </div>
            <span className="text-xs text-gray-500">Conectando...</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">{peer.name}</span>
      </div>
    </div>
  )
}
