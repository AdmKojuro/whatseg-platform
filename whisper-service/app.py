from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import os, threading, asyncio, tempfile

app = Flask(__name__)
_model = None
_lock = threading.Lock()

def get_model():
    global _model
    if _model is None:
        _model = WhisperModel('small', device='cpu', compute_type='int8')
    return _model

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model': 'small'})

@app.route('/transcribir', methods=['POST'])
def transcribir():
    data = request.get_json(force=True)
    audio_path = data.get('path', '')
    if not audio_path or not os.path.exists(audio_path):
        return jsonify({'error': 'archivo no encontrado', 'path': audio_path}), 400
    try:
        with _lock:
            model = get_model()
            segments, info = model.transcribe(audio_path, language='es', beam_size=5)
            texto = ' '.join(s.text.strip() for s in segments).strip()
        return jsonify({'texto': texto, 'language': info.language})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─── TTS: texto → audio MP3 ──────────────────────────────────────────────────

@app.route('/tts', methods=['POST'])
def tts():
    data = request.get_json(force=True)
    texto = data.get('texto', '').strip()
    voz = data.get('voz', 'es-CO-SalomeNeural')
    if not texto:
        return jsonify({'error': 'texto vacío'}), 400
    try:
        import edge_tts
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
            path = f.name
        asyncio.run(edge_tts.Communicate(texto, voz).save(path))
        return jsonify({'path': path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print('[WHISPER] Cargando modelo small...')
    get_model()
    print('[WHISPER] Modelo listo. Iniciando servidor en puerto 5001')
    app.run(host='0.0.0.0', port=5001, threaded=False)
