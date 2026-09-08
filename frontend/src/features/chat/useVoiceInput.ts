import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../shared/api'
import { upload } from '../workspace/upload'

/**
 * Запись реплики с микрофона и её расшифровка.
 *
 * Готовый текст не отправляется сам: распознавание спотыкается на именах и
 * номерах статей, и возможность поправить строку до отправки важнее
 * сэкономленного нажатия. Поэтому хук отдаёт текст наружу, а что с ним
 * делать — решает экран.
 *
 * Микрофон доступен только в защищённом контексте (HTTPS или localhost) —
 * так устроены браузеры. На стенде, открытом по обычному HTTP, `supported`
 * будет false, и экран обязан сказать об этом прямо: иначе кнопка выглядит
 * сломанной, хотя дело в адресе страницы.
 */

export type VoiceState = 'idle' | 'recording' | 'transcribing'

interface Options {
  onText: (text: string) => void
  onError: (message: string) => void
}

/** Защищённый контекст и наличие самого API записи. */
function detectSupport() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.isSecureContext &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof window.MediaRecorder === 'function',
  )
}

export function useVoiceInput({ onText, onError }: Options) {
  const [state, setState] = useState<VoiceState>('idle')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Колбэки держим в ref: иначе каждая перерисовка экрана меняла бы
  // тождество stop/start и обработчики записи цеплялись бы к устаревшим.
  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)
  onTextRef.current = onText
  onErrorRef.current = onError

  const supported = detectSupport()

  const release = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  // Уход со страницы во время записи не должен оставлять микрофон включённым:
  // индикатор в браузере продолжал бы гореть после закрытия чата.
  useEffect(() => release, [release])

  const start = useCallback(async () => {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onErrorRef.current('denied')
      return
    }

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      release()

      if (blob.size === 0) {
        setState('idle')
        onErrorRef.current('empty')
        return
      }

      setState('transcribing')
      const form = new FormData()
      form.append('audio', blob, 'voice.webm')
      try {
        const res = await upload<{ text: string }>('/api/chat/transcribe', form)
        onTextRef.current(res.text)
      } catch (e) {
        onErrorRef.current(e instanceof ApiError ? e.message : 'failed')
      } finally {
        setState('idle')
      }
    }

    recorder.start()
    setState('recording')
  }, [release])

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }, [])

  const toggle = useCallback(() => {
    if (state === 'recording') stop()
    else if (state === 'idle') void start()
  }, [state, start, stop])

  return { state, supported, toggle }
}
