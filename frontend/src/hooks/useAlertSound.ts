import { useCallback, useRef } from 'react'

export function useAlertSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/whatseg_sound.mp3')
        audioRef.current.volume = 0.7
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => { /* autoplay bloqueado por el navegador */ })
    } catch { /* ignore */ }
  }, [])

  return { play }
}
