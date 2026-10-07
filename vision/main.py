"""
WhatsEg Vision Service v2.0
Microservicio de inteligencia artificial para análisis de video en tiempo real.
Nuevas capacidades:
  - ALPR: reconocimiento de placas vehiculares (YOLO + PaddleOCR)
  - BehaviorAnalyzer: detección de comportamientos sin identidad (merodeo, vigilancia, intercambio)
  - AcousticDetector: clasificación de eventos de audio (disparos, gritos) vía YAMNet

Pipeline rostros (v1):
  Frame → YOLO → Haar/DeepFace → Facenet512 → Cosine similarity → Match/Alert
"""

import os
import sys
import json
import time
import uuid
import hashlib
import sqlite3
import logging
import threading
import base64
import io
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, List, Any
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import requests
from flask import Flask, request, jsonify, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS

# ─── Rutas base ───────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
EXPEDIENTES_DIR = DATA_DIR / "expedientes"
LOGS_DIR = BASE_DIR / "logs"

for d in [DATA_DIR, MODELS_DIR, SNAPSHOTS_DIR, EXPEDIENTES_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOGS_DIR / "vision.log"),
    ],
)
log = logging.getLogger("vision")

# ─── Configuración ────────────────────────────────────────────────────────────
@dataclass
class Config:
    port: int = 8001
    debug: bool = False

    # YOLO
    person_confidence: float = 0.55
    yolo_model: str = "yolo11n.pt"
    process_every_n: int = 4          # procesar 1 de cada N frames
    main_imgsz: int = 480

    # Reconocimiento de rostros
    face_enabled: bool = True
    face_model: str = "Facenet512"
    face_detector: str = "opencv"     # opencv o yunet
    face_threshold: float = 0.30      # cosine distance — menor = más estricto
    face_min_size: int = 40           # px mínimos para procesar rostro
    face_upscale: float = 2.5
    face_process_every_n: int = 5

    # Alertas
    alert_cooldown_secs: int = 30
    backend_ext_url: str = "http://localhost:3068"
    backend_ext_token: str = ""        # JWT para llamadas internas

    # Stream
    stream_quality: int = 70
    max_stream_fps: int = 10

    # ALPR (reconocimiento de placas)
    alpr_enabled: bool = True
    alpr_confidence: float = 0.40          # confianza YOLO para vehículos
    alpr_ocr_lang: str = "es"

    # Análisis de comportamiento
    behavior_enabled: bool = True
    loiter_seconds: int = 300              # segundos para detectar merodeo (5 min)
    stationary_seconds: int = 180          # segundos para vigilancia estacionaria (3 min)
    loiter_radius_px: int = 80            # radio en píxeles para considerar "misma zona"

    # Detección acústica
    acoustic_enabled: bool = False         # requiere micrófono en el servidor
    acoustic_sample_rate: int = 16000
    acoustic_window_secs: float = 0.975   # ventana YAMNet estándar

def load_config() -> Config:
    cfg_path = BASE_DIR / "config.json"
    cfg = Config()
    if cfg_path.exists():
        with open(cfg_path) as f:
            data = json.load(f)
        for k, v in data.items():
            if hasattr(cfg, k):
                setattr(cfg, k, v)
    return cfg

CONFIG = load_config()

# ─── Base de datos SQLite ──────────────────────────────────────────────────────
DB_PATH = DATA_DIR / "vision.db"

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS cameras (
            id          TEXT PRIMARY KEY,
            nombre      TEXT NOT NULL,
            rtsp_url    TEXT NOT NULL,
            comunidad_id TEXT,
            activa      INTEGER DEFAULT 1,
            lat         REAL,
            lng         REAL,
            added_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS face_identities (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            face_track_id   TEXT UNIQUE NOT NULL,
            embedding       TEXT NOT NULL,  -- JSON array 512 floats
            snapshot_path   TEXT,
            camera_id       TEXT,
            comunidad_id    TEXT,
            first_seen      TEXT DEFAULT (datetime('now')),
            last_seen       TEXT DEFAULT (datetime('now')),
            detection_count INTEGER DEFAULT 1,
            label           TEXT            -- asignado manualmente
        );

        CREATE TABLE IF NOT EXISTS expedientes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre          TEXT,
            descripcion     TEXT,
            tipo            TEXT DEFAULT 'SOSPECHOSO',
            estado          TEXT DEFAULT 'ACTIVO',
            embedding       TEXT,           -- JSON array 512 floats
            photo_path      TEXT,
            notas           TEXT,
            alerta_nivel    TEXT DEFAULT 'ALTA',
            created_at      TEXT DEFAULT (datetime('now')),
            backend_id      TEXT            -- UUID del backend PostgreSQL
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT DEFAULT (datetime('now')),
            camera_id       TEXT,
            comunidad_id    TEXT,
            alert_type      TEXT NOT NULL,
            severity        TEXT DEFAULT 'ALTA',
            descripcion     TEXT,
            face_track_id   TEXT,
            expediente_id   INTEGER,
            similitud       REAL,
            snapshot_path   TEXT,
            sent_to_backend INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_faces_last ON face_identities(last_seen DESC);

        -- ALPR: placas detectadas
        CREATE TABLE IF NOT EXISTS plate_detections (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT DEFAULT (datetime('now')),
            camera_id       TEXT,
            comunidad_id    TEXT,
            placa           TEXT NOT NULL,
            confianza       REAL,
            denegada        INTEGER DEFAULT 0,   -- 1 si está en lista negra
            snapshot_path   TEXT,
            sent_to_backend INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_plates_ts ON plate_detections(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_plates_placa ON plate_detections(placa);

        -- Lista negra local de placas (sincronizada desde backend-ext)
        CREATE TABLE IF NOT EXISTS placas_denegadas_local (
            placa       TEXT PRIMARY KEY,
            nivel       TEXT DEFAULT 'MEDIA',
            descripcion TEXT,
            activa      INTEGER DEFAULT 1
        );

        -- Alertas de comportamiento
        CREATE TABLE IF NOT EXISTS behavior_alerts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT DEFAULT (datetime('now')),
            camera_id       TEXT,
            comunidad_id    TEXT,
            tipo            TEXT NOT NULL,   -- MERODEO, VIGILANCIA_ESTACIONARIA, INTERCAMBIO_RAPIDO
            duracion_seg    INTEGER,
            track_ids       TEXT,            -- JSON array
            snapshot_path   TEXT,
            sent_to_backend INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_beh_ts ON behavior_alerts(timestamp DESC);

        -- Eventos acústicos
        CREATE TABLE IF NOT EXISTS acoustic_events (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT DEFAULT (datetime('now')),
            clase           TEXT NOT NULL,   -- Gunshot, Screaming, Glass...
            confianza       REAL,
            fuente          TEXT DEFAULT 'LOCAL_MIC',
            sent_to_backend INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    conn.close()
    log.info("Base de datos inicializada")

# ─── Motor de reconocimiento de rostros ───────────────────────────────────────
class FaceEngine:
    """
    Pipeline de reconocimiento de patrones de rostros:
    1. Detectar rostro (Haar rápido → DeepFace fallback)
    2. Generar embedding Facenet512 (512-dim vector)
    3. Comparar por cosine similarity contra cache e expedientes
    4. Agrupar apariciones del mismo desconocido en FID-XXXX
    5. Alertar si coincide con expediente
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._id_cache: List[Dict] = []     # embeddings en memoria
        self._exp_cache: List[Dict] = []    # expedientes en memoria
        self._alert_cooldowns: Dict[str, float] = {}
        self._queue: List[tuple] = []
        self._worker = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker.start()
        self._load_caches()
        log.info("FaceEngine inicializado")

    def _load_caches(self):
        """Carga embeddings de faces e expedientes desde SQLite a memoria"""
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT id, face_track_id, embedding FROM face_identities"
            ).fetchall()
            self._id_cache = [
                {
                    "id": r["id"],
                    "face_track_id": r["face_track_id"],
                    "emb": np.array(json.loads(r["embedding"]), dtype=np.float32),
                }
                for r in rows
            ]

            rows = conn.execute(
                "SELECT id, nombre, embedding, alerta_nivel FROM expedientes "
                "WHERE estado='ACTIVO' AND embedding IS NOT NULL"
            ).fetchall()
            self._exp_cache = [
                {
                    "id": r["id"],
                    "nombre": r["nombre"],
                    "emb": np.array(json.loads(r["embedding"]), dtype=np.float32),
                    "alerta_nivel": r["alerta_nivel"],
                }
                for r in rows
            ]
            log.info(f"Cache cargado: {len(self._id_cache)} identidades, {len(self._exp_cache)} expedientes")
        finally:
            conn.close()

    def reload_expedientes(self):
        """Recarga el cache de expedientes (llamar cuando se añade uno nuevo)"""
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT id, nombre, embedding, alerta_nivel FROM expedientes "
                "WHERE estado='ACTIVO' AND embedding IS NOT NULL"
            ).fetchall()
            with self._lock:
                self._exp_cache = [
                    {
                        "id": r["id"],
                        "nombre": r["nombre"],
                        "emb": np.array(json.loads(r["embedding"]), dtype=np.float32),
                        "alerta_nivel": r["alerta_nivel"],
                    }
                    for r in rows
                ]
        finally:
            conn.close()

    @staticmethod
    def _cosine_distance(a: np.ndarray, b: np.ndarray) -> float:
        na = np.linalg.norm(a)
        nb = np.linalg.norm(b)
        if na == 0 or nb == 0:
            return 1.0
        return float(1.0 - np.dot(a, b) / (na * nb))

    @staticmethod
    def _detect_faces_haar(img: np.ndarray) -> List:
        """Detección rápida con Haar Cascade (frontal)"""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(CONFIG.face_min_size, CONFIG.face_min_size),
        )
        return list(faces) if len(faces) > 0 else []

    @staticmethod
    def _detect_faces_deepface(img: np.ndarray) -> List:
        """Fallback: DeepFace para perfiles y condiciones difíciles"""
        try:
            from deepface import DeepFace
            faces = DeepFace.extract_faces(
                img_path=img,
                detector_backend=CONFIG.face_detector,
                enforce_detection=False,
                align=True,
            )
            result = []
            for f in faces:
                if f.get("confidence", 0) < 0.5:
                    continue
                r = f["facial_area"]
                result.append((r["x"], r["y"], r["w"], r["h"]))
            return result
        except Exception:
            return []

    @staticmethod
    def _get_embedding(face_img: np.ndarray) -> Optional[np.ndarray]:
        """Genera embedding Facenet512 de 512 dimensiones"""
        try:
            from deepface import DeepFace
            face_resized = cv2.resize(face_img, (160, 160))
            reps = DeepFace.represent(
                img_path=face_resized,
                model_name=CONFIG.face_model,
                detector_backend="skip",
                enforce_detection=False,
            )
            if reps:
                return np.array(reps[0]["embedding"], dtype=np.float32)
        except Exception as e:
            log.debug(f"Error generando embedding: {e}")
        return None

    def _find_in_cache(self, emb: np.ndarray) -> Optional[Dict]:
        """Busca en cache de identidades conocidas por cosine similarity"""
        best_dist = CONFIG.face_threshold
        best = None
        for entry in self._id_cache:
            dist = self._cosine_distance(emb, entry["emb"])
            if dist < best_dist:
                best_dist = dist
                best = entry
        return best

    def _find_in_expedientes(self, emb: np.ndarray) -> Optional[Dict]:
        """Busca si el embedding coincide con algún expediente"""
        best_dist = CONFIG.face_threshold
        best = None
        for exp in self._exp_cache:
            dist = self._cosine_distance(emb, exp["emb"])
            if dist < best_dist:
                best_dist = dist
                best = {**exp, "similitud": 1.0 - best_dist}
        return best

    def _save_snapshot(self, face_img: np.ndarray, prefix: str) -> str:
        fname = f"{prefix}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
        path = SNAPSHOTS_DIR / fname
        cv2.imwrite(str(path), face_img)
        return str(path)

    def _register_new_identity(self, emb: np.ndarray, face_img: np.ndarray,
                                camera_id: str, comunidad_id: Optional[str]) -> str:
        """Registra nueva identidad FID-XXXX en SQLite y cache"""
        snap = self._save_snapshot(face_img, "face")
        emb_json = json.dumps(emb.tolist())
        conn = get_db()
        try:
            cur = conn.execute(
                "INSERT INTO face_identities (face_track_id, embedding, snapshot_path, "
                "camera_id, comunidad_id) VALUES (?,?,?,?,?)",
                (f"FID-{int(time.time()*1000) % 100000:05d}", emb_json, snap, camera_id, comunidad_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT id, face_track_id FROM face_identities WHERE id=?", (cur.lastrowid,)
            ).fetchone()
            fid = row["face_track_id"]
            db_id = row["id"]
            # actualizar face_track_id con ID real
            fid_final = f"FID-{db_id:05d}"
            conn.execute("UPDATE face_identities SET face_track_id=? WHERE id=?", (fid_final, db_id))
            conn.commit()
            with self._lock:
                self._id_cache.append({"id": db_id, "face_track_id": fid_final, "emb": emb})
            return fid_final
        finally:
            conn.close()

    def _update_identity_hit(self, db_id: int, camera_id: str, comunidad_id: Optional[str]):
        """Actualiza contador y last_seen de una identidad existente"""
        conn = get_db()
        try:
            conn.execute(
                "UPDATE face_identities SET detection_count=detection_count+1, "
                "last_seen=datetime('now'), camera_id=?, comunidad_id=? WHERE id=?",
                (camera_id, comunidad_id, db_id),
            )
            conn.commit()
        finally:
            conn.close()

    def _log_alert(self, camera_id: str, comunidad_id: Optional[str],
                   alert_type: str, severity: str, descripcion: str,
                   face_track_id: Optional[str], expediente_id: Optional[int],
                   similitud: Optional[float], snapshot_path: Optional[str]) -> int:
        conn = get_db()
        try:
            cur = conn.execute(
                "INSERT INTO alerts (camera_id, comunidad_id, alert_type, severity, "
                "descripcion, face_track_id, expediente_id, similitud, snapshot_path) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (camera_id, comunidad_id, alert_type, severity, descripcion,
                 face_track_id, expediente_id, similitud, snapshot_path),
            )
            conn.commit()
            return cur.lastrowid
        finally:
            conn.close()

    def _check_cooldown(self, key: str) -> bool:
        """Retorna True si está en cooldown (no enviar alerta)"""
        now = time.time()
        last = self._alert_cooldowns.get(key, 0)
        if now - last < CONFIG.alert_cooldown_secs:
            return True
        self._alert_cooldowns[key] = now
        return False

    def _notify_backend_ext(self, alert_data: Dict):
        """Envía alerta al backend-ext para persistir en PostgreSQL"""
        try:
            headers = {}
            if CONFIG.backend_ext_token:
                headers["Authorization"] = f"Bearer {CONFIG.backend_ext_token}"
            requests.post(
                f"{CONFIG.backend_ext_url}/ext/alertas-ia",
                json=alert_data,
                headers=headers,
                timeout=5,
            )
        except Exception as e:
            log.debug(f"No se pudo notificar al backend-ext: {e}")

    def process_roi(self, camera_id: str, comunidad_id: Optional[str],
                    roi: np.ndarray, full_frame: np.ndarray):
        """Procesa una región de interés (cabeza de persona) de forma asíncrona"""
        self._queue.append((camera_id, comunidad_id, roi, full_frame))

    def _worker_loop(self):
        """Worker thread que procesa rostros de la cola"""
        while True:
            if not self._queue:
                time.sleep(0.05)
                continue
            item = self._queue.pop(0)
            try:
                self._process_face(*item)
            except Exception as e:
                log.debug(f"Error procesando rostro: {e}")

    def _process_face(self, camera_id: str, comunidad_id: Optional[str],
                      roi: np.ndarray, full_frame: np.ndarray):
        """Pipeline completo de reconocimiento para un ROI"""
        if roi.shape[0] < CONFIG.face_min_size or roi.shape[1] < CONFIG.face_min_size:
            # Upscale si el rostro es pequeño (persona lejana)
            roi = cv2.resize(
                roi,
                (int(roi.shape[1] * CONFIG.face_upscale),
                 int(roi.shape[0] * CONFIG.face_upscale))
            )

        # Detección de rostros: primero Haar (rápido), luego DeepFace
        bboxes = self._detect_faces_haar(roi)
        if not bboxes:
            bboxes = self._detect_faces_deepface(roi)

        for bbox in bboxes:
            x, y, w, h = bbox
            if w < CONFIG.face_min_size:
                continue
            face_crop = roi[max(0, y):y+h, max(0, x):x+w]
            if face_crop.size == 0:
                continue

            emb = self._get_embedding(face_crop)
            if emb is None:
                continue

            # Buscar en cache de identidades conocidas
            with self._lock:
                matched = self._find_in_cache(emb)

            if matched:
                fid = matched["face_track_id"]
                self._update_identity_hit(matched["id"], camera_id, comunidad_id)
            else:
                fid = self._register_new_identity(emb, face_crop, camera_id, comunidad_id)
                log.info(f"Nueva identidad detectada: {fid} en cámara {camera_id}")

                # Alerta de persona nueva recurrente (si ya hay 3+ visitas del mismo desconocido)
                conn = get_db()
                try:
                    row = conn.execute(
                        "SELECT detection_count FROM face_identities WHERE face_track_id=?", (fid,)
                    ).fetchone()
                    count = row["detection_count"] if row else 1
                finally:
                    conn.close()

                if count >= 3:
                    cooldown_key = f"recurrente:{fid}"
                    if not self._check_cooldown(cooldown_key):
                        snap = self._save_snapshot(face_crop, f"recurrente_{fid}")
                        alert_id = self._log_alert(
                            camera_id, comunidad_id, "FACE_RECURRENTE", "MEDIA",
                            f"Persona desconocida {fid} detectada {count} veces",
                            fid, None, None, snap,
                        )
                        self._notify_backend_ext({
                            "alert_id": alert_id,
                            "camera_id": camera_id,
                            "comunidad_id": comunidad_id,
                            "tipo_alerta": "FACE_RECURRENTE",
                            "severidad": "MEDIA",
                            "descripcion": f"Persona desconocida {fid} detectada {count} veces",
                            "face_track_id": fid,
                            "snapshot_path": snap,
                        })

            # Comparar con expedientes (watchlist)
            with self._lock:
                exp_match = self._find_in_expedientes(emb)

            if exp_match:
                cooldown_key = f"exp:{exp_match['id']}:{camera_id}"
                if not self._check_cooldown(cooldown_key):
                    snap = self._save_snapshot(face_crop, f"match_exp{exp_match['id']}")
                    nombre = exp_match.get("nombre") or "Desconocido"
                    sim = exp_match["similitud"]
                    alerta_nivel = exp_match.get("alerta_nivel", "ALTA")
                    alert_id = self._log_alert(
                        camera_id, comunidad_id, "FACE_MATCH", alerta_nivel,
                        f"Coincidencia con expediente: {nombre} ({sim:.0%} similitud)",
                        fid, exp_match["id"], sim, snap,
                    )
                    log.warning(f"MATCH EXPEDIENTE: {nombre} en {camera_id} ({sim:.0%})")
                    self._notify_backend_ext({
                        "alert_id": alert_id,
                        "camera_id": camera_id,
                        "comunidad_id": comunidad_id,
                        "tipo_alerta": "FACE_MATCH",
                        "severidad": alerta_nivel,
                        "descripcion": f"Coincidencia con expediente: {nombre} ({sim:.0%})",
                        "face_track_id": fid,
                        "expediente_id": exp_match["id"],
                        "similitud": sim,
                        "snapshot_path": snap,
                    })
                    # Emitir alerta en tiempo real vía SocketIO
                    socketio.emit("nueva_alerta", {
                        "tipo": "FACE_MATCH",
                        "expediente": nombre,
                        "similitud": f"{sim:.0%}",
                        "camera_id": camera_id,
                        "timestamp": datetime.now().isoformat(),
                    })

    def generate_embedding_from_image(self, img: np.ndarray) -> Optional[List[float]]:
        """Genera embedding de una imagen para guardar en expediente"""
        emb = self._get_embedding(img)
        if emb is not None:
            return emb.tolist()
        return None


# ─── ALPR: Reconocimiento Automático de Placas ────────────────────────────────
class PlateRecognizer:
    """
    Pipeline ALPR para formato colombiano (ABC123 / ABC12D):
      Frame → YOLO detecta vehículo → recorta placa (30% inferior) →
      PaddleOCR extrae texto → normaliza → cruza contra lista negra
    """

    VEHICLE_CLASSES = [2, 3, 5, 7]   # car, motorcycle, bus, truck (COCO)

    def __init__(self):
        self._lock = threading.Lock()
        self._denied: Dict[str, Dict] = {}    # placa → {nivel, descripcion}
        self._alert_cooldowns: Dict[str, float] = {}
        self._ocr = None
        self._load_ocr()
        self._load_denied_list()
        log.info(f"PlateRecognizer inicializado — {len(self._denied)} placas en lista negra")

    def _load_ocr(self):
        try:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            log.info("PaddleOCR cargado para ALPR")
        except Exception as e:
            log.warning(f"PaddleOCR no disponible ({e}) — ALPR deshabilitado")

    def _load_denied_list(self):
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT placa, nivel, descripcion FROM placas_denegadas_local WHERE activa=1"
            ).fetchall()
            with self._lock:
                self._denied = {r["placa"]: dict(r) for r in rows}
        finally:
            conn.close()

    def reload_denied_list(self):
        self._load_denied_list()

    @staticmethod
    def normalize_plate(text: str) -> Optional[str]:
        """Normaliza y valida formato colombiano: ABC123 o ABC12D"""
        import re
        clean = re.sub(r'[^A-Z0-9]', '', text.upper().strip())
        # Formatos: 3 letras + 3 dígitos (motos/carros antes 2000) o 3 letras + 2 dígitos + 1 letra
        if re.match(r'^[A-Z]{3}[0-9]{3}$', clean) or re.match(r'^[A-Z]{3}[0-9]{2}[A-Z]$', clean):
            return clean
        # Tolerancia: 6 alfanuméricos con al menos 2 letras al inicio
        if len(clean) == 6 and re.match(r'^[A-Z]{2}', clean):
            return clean
        return None

    def _check_cooldown(self, key: str) -> bool:
        now = time.time()
        last = self._alert_cooldowns.get(key, 0)
        if now - last < CONFIG.alert_cooldown_secs:
            return True
        self._alert_cooldowns[key] = now
        return False

    def _save_snapshot(self, frame: np.ndarray, prefix: str) -> Optional[str]:
        try:
            fname = f"{prefix}_{int(time.time())}.jpg"
            fpath = str(SNAPSHOTS_DIR / fname)
            cv2.imwrite(fpath, frame)
            return fpath
        except Exception:
            return None

    def process_frame(self, frame: np.ndarray, camera_id: str,
                      comunidad_id: Optional[str]) -> List[Dict]:
        """Detecta vehículos y extrae placas. Retorna lista de detecciones."""
        if not CONFIG.alpr_enabled or self._ocr is None:
            return []
        detections = []
        try:
            model = _get_yolo_model()
            if model is None:
                return []
            results = model(frame, conf=CONFIG.alpr_confidence,
                           classes=self.VEHICLE_CLASSES, verbose=False,
                           imgsz=CONFIG.main_imgsz)
            for r in results:
                if r.boxes is None:
                    continue
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    # Zona de placa: 30% inferior del vehículo, zona central
                    vehicle_h = y2 - y1
                    plate_y1 = y2 - int(vehicle_h * 0.30)
                    plate_x1 = x1 + int((x2 - x1) * 0.15)
                    plate_x2 = x2 - int((x2 - x1) * 0.15)
                    plate_roi = frame[plate_y1:y2, plate_x1:plate_x2]
                    if plate_roi.size == 0:
                        continue

                    # Preprocesamiento: escalar y mejorar contraste
                    plate_roi = cv2.resize(plate_roi, None, fx=3, fy=3,
                                          interpolation=cv2.INTER_CUBIC)
                    gray = cv2.cvtColor(plate_roi, cv2.COLOR_BGR2GRAY)
                    _, plate_bin = cv2.threshold(gray, 0, 255,
                                                 cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                    plate_rgb = cv2.cvtColor(plate_bin, cv2.COLOR_GRAY2RGB)

                    try:
                        ocr_result = self._ocr.ocr(plate_rgb, cls=True)
                        if not ocr_result or not ocr_result[0]:
                            continue
                        texts = [line[1][0] for line in ocr_result[0] if line[1][1] > 0.6]
                        raw_text = " ".join(texts)
                        placa = self.normalize_plate(raw_text)
                        if placa is None:
                            continue

                        confianza = float(box.conf[0])
                        snap = self._save_snapshot(frame, f"plate_{placa}")
                        det = {
                            "placa": placa,
                            "confianza": confianza,
                            "camera_id": camera_id,
                            "comunidad_id": comunidad_id,
                            "snapshot_path": snap,
                        }

                        # Verificar lista negra
                        with self._lock:
                            denegada = self._denied.get(placa)

                        conn = get_db()
                        try:
                            cur = conn.execute(
                                "INSERT INTO plate_detections "
                                "(camera_id, comunidad_id, placa, confianza, denegada, snapshot_path) "
                                "VALUES (?,?,?,?,?,?)",
                                (camera_id, comunidad_id, placa, confianza,
                                 1 if denegada else 0, snap),
                            )
                            conn.commit()
                            det["id"] = cur.lastrowid
                        finally:
                            conn.close()

                        if denegada:
                            cooldown_key = f"plate:{placa}:{camera_id}"
                            if not self._check_cooldown(cooldown_key):
                                det["denegada"] = True
                                det["nivel"] = denegada.get("nivel", "MEDIA")
                                self._notify_plate_alert(det, denegada)

                        detections.append(det)
                    except Exception as e:
                        log.debug(f"Error OCR placa: {e}")
        except Exception as e:
            log.debug(f"Error ALPR frame {camera_id}: {e}")
        return detections

    def _notify_plate_alert(self, det: Dict, info_denegada: Dict):
        """Notifica al backend-ext y emite vía SocketIO"""
        payload = {
            "camera_id": det["camera_id"],
            "comunidad_id": det.get("comunidad_id"),
            "placa_detectada": det["placa"],
            "confianza": det["confianza"],
            "snapshot_path": det.get("snapshot_path"),
            "nivel": info_denegada.get("nivel", "MEDIA"),
        }
        try:
            requests.post(
                f"{CONFIG.backend_ext_url}/ext/placas/alerta",
                json=payload, timeout=3,
            )
        except Exception:
            pass
        socketio.emit("placa_alerta", {
            "placa": det["placa"],
            "nivel": info_denegada.get("nivel", "MEDIA"),
            "camera_id": det["camera_id"],
            "timestamp": datetime.now().isoformat(),
        })
        log.warning(f"PLACA DENEGADA: {det['placa']} en {det['camera_id']}")


# ─── Analizador de Comportamiento (sin identidad) ─────────────────────────────
class BehaviorAnalyzer:
    """
    Detecta patrones de comportamiento sospechoso sin necesidad de identificar personas.
    Tipos:
      - MERODEO: misma persona ronda el mismo punto > N segundos
      - VIGILANCIA_ESTACIONARIA: persona quieta frente a entrada > N segundos
      - INTERCAMBIO_RAPIDO: dos tracks se cruzan en < 3s y divergen
    """

    def __init__(self):
        self._tracks: Dict[str, List[tuple]] = {}   # track_id → [(ts, cx, cy)]
        self._pair_events: List[tuple] = []          # para detectar intercambios
        self._alert_cooldowns: Dict[str, float] = {}
        self._lock = threading.Lock()
        # Limpiar tracks viejos cada 5 minutos
        t = threading.Thread(target=self._cleanup_loop, daemon=True)
        t.start()
        log.info("BehaviorAnalyzer inicializado")

    def _cleanup_loop(self):
        while True:
            time.sleep(300)
            cutoff = time.time() - 1200   # descartar tracks > 20 min
            with self._lock:
                to_del = [k for k, v in self._tracks.items()
                          if v and v[-1][0] < cutoff]
                for k in to_del:
                    del self._tracks[k]

    def update(self, track_id: str, cx: int, cy: int,
               camera_id: str, comunidad_id: Optional[str]):
        """Actualizar posición del track y evaluar comportamientos"""
        if not CONFIG.behavior_enabled:
            return
        now = time.time()
        with self._lock:
            if track_id not in self._tracks:
                self._tracks[track_id] = []
            self._tracks[track_id].append((now, cx, cy))
            # Mantener solo 20 min de historia
            cutoff = now - 1200
            self._tracks[track_id] = [(t, x, y) for t, x, y in self._tracks[track_id]
                                       if t > cutoff]
            positions = list(self._tracks[track_id])

        self._check_loitering(track_id, positions, camera_id, comunidad_id)
        self._check_stationary(track_id, positions, camera_id, comunidad_id)
        self._check_quick_exchange(track_id, cx, cy, now, camera_id, comunidad_id)

    def _check_loitering(self, track_id: str, positions: List[tuple],
                          camera_id: str, comunidad_id: Optional[str]):
        if len(positions) < 10:
            return
        earliest = positions[0][0]
        if time.time() - earliest < CONFIG.loiter_seconds:
            return
        # Calcular extensión del área recorrida
        xs = [p[1] for p in positions]
        ys = [p[2] for p in positions]
        spread = max(max(xs)-min(xs), max(ys)-min(ys))
        if spread > CONFIG.loiter_radius_px * 3:
            return   # se movió mucho → no es merodeo
        cooldown_key = f"loiter:{track_id}:{camera_id}"
        if self._check_cooldown(cooldown_key):
            return
        duration = int(time.time() - earliest)
        self._save_alert("MERODEO", [track_id], duration, camera_id, comunidad_id, None)

    def _check_stationary(self, track_id: str, positions: List[tuple],
                           camera_id: str, comunidad_id: Optional[str]):
        if len(positions) < 5:
            return
        last_n = positions[-20:] if len(positions) > 20 else positions
        xs = [p[1] for p in last_n]
        ys = [p[2] for p in last_n]
        spread = max(max(xs)-min(xs), max(ys)-min(ys))
        if spread > 20:   # se movió más de 20px → no está estático
            return
        elapsed = last_n[-1][0] - last_n[0][0]
        if elapsed < CONFIG.stationary_seconds:
            return
        cooldown_key = f"stat:{track_id}:{camera_id}"
        if self._check_cooldown(cooldown_key):
            return
        self._save_alert("VIGILANCIA_ESTACIONARIA", [track_id], int(elapsed),
                         camera_id, comunidad_id, None)

    def _check_quick_exchange(self, track_id: str, cx: int, cy: int,
                               now: float, camera_id: str, comunidad_id: Optional[str]):
        # Guardar posición reciente para cruce
        self._pair_events = [(t, tid, x, y, cam)
                             for t, tid, x, y, cam in self._pair_events
                             if now - t < 10]   # ventana de 10 segundos
        # Buscar otro track cercano que estuvo en el mismo punto
        for prev_t, prev_tid, prev_x, prev_y, prev_cam in self._pair_events:
            if prev_tid == track_id or prev_cam != camera_id:
                continue
            dist = ((cx - prev_x)**2 + (cy - prev_y)**2) ** 0.5
            if dist < 40:   # se cruzaron a < 40px
                pair_key = tuple(sorted([track_id, prev_tid]))
                cooldown_key = f"exch:{pair_key}:{camera_id}"
                if not self._check_cooldown(cooldown_key):
                    self._save_alert("INTERCAMBIO_RAPIDO",
                                     [track_id, prev_tid], int(now - prev_t),
                                     camera_id, comunidad_id, None)
        self._pair_events.append((now, track_id, cx, cy, camera_id))

    def _check_cooldown(self, key: str) -> bool:
        now = time.time()
        last = self._alert_cooldowns.get(key, 0)
        if now - last < CONFIG.alert_cooldown_secs * 2:
            return True
        self._alert_cooldowns[key] = now
        return False

    def _save_alert(self, tipo: str, track_ids: List[str], duration: int,
                    camera_id: str, comunidad_id: Optional[str],
                    snapshot_path: Optional[str]):
        track_json = json.dumps(track_ids)
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO behavior_alerts "
                "(camera_id, comunidad_id, tipo, duracion_seg, track_ids, snapshot_path) "
                "VALUES (?,?,?,?,?,?)",
                (camera_id, comunidad_id, tipo, duration, track_json, snapshot_path),
            )
            conn.commit()
        finally:
            conn.close()
        log.warning(f"COMPORTAMIENTO {tipo}: tracks={track_ids} cam={camera_id} dur={duration}s")
        payload = {
            "camera_id": camera_id,
            "comunidad_id": comunidad_id,
            "tipo": tipo,
            "duracion_seg": duration,
            "track_ids": track_ids,
            "snapshot_path": snapshot_path,
        }
        try:
            requests.post(f"{CONFIG.backend_ext_url}/ext/comportamiento/alerta",
                          json=payload, timeout=3)
        except Exception:
            pass
        socketio.emit("comportamiento_alerta", {
            "tipo": tipo,
            "camera_id": camera_id,
            "duracion": f"{duration}s",
            "timestamp": datetime.now().isoformat(),
        })


# ─── Detector Acústico ────────────────────────────────────────────────────────
class AcousticDetector:
    """
    Clasifica eventos de audio usando YAMNet (Google).
    Detecta: disparos, gritos, explosiones, vidrios rotos.
    Requiere: sounddevice + tensorflow-hub en el servidor con micrófono.
    Se degrada graciosamente si no hay hardware/librería disponible.
    """

    ALERT_CLASSES = {
        "Gunshot, gunfire": ("DISPARO", "CRITICA"),
        "Screaming": ("GRITO", "ALTA"),
        "Glass": ("VIDRIO_ROTO", "ALTA"),
        "Explosion": ("EXPLOSION", "CRITICA"),
        "Shatter": ("VIDRIO_ROTO", "ALTA"),
    }

    def __init__(self):
        self.available = False
        self._model = None
        self._class_names: List[str] = []
        self._alert_cooldowns: Dict[str, float] = {}
        if not CONFIG.acoustic_enabled:
            log.info("AcousticDetector deshabilitado en config")
            return
        self._init_model()

    def _init_model(self):
        try:
            import sounddevice as sd
            import tensorflow_hub as hub
            import csv, io as _io
            self._sd = sd
            self._model = hub.load("https://tfhub.dev/google/yamnet/1")
            # Cargar nombres de clases YAMNet
            class_map_path = self._model.class_map_path().numpy().decode()
            with open(class_map_path) as f:
                reader = csv.DictReader(f)
                self._class_names = [r["display_name"] for r in reader]
            self.available = True
            log.info("AcousticDetector: YAMNet cargado correctamente")
            t = threading.Thread(target=self._listen_loop, daemon=True)
            t.start()
        except Exception as e:
            log.warning(f"AcousticDetector no disponible: {e}")

    def _listen_loop(self):
        """Loop de captura y clasificación de audio"""
        chunk_samples = int(CONFIG.acoustic_sample_rate * CONFIG.acoustic_window_secs)
        log.info(f"AcousticDetector escuchando micrófono ({CONFIG.acoustic_sample_rate}Hz)")
        try:
            while True:
                audio = self._sd.rec(
                    chunk_samples,
                    samplerate=CONFIG.acoustic_sample_rate,
                    channels=1, dtype="float32",
                )
                self._sd.wait()
                waveform = audio.flatten()
                scores, embeddings, spectrogram = self._model(waveform)
                top_scores = scores.numpy().mean(axis=0)
                top_idx = top_scores.argsort()[-3:][::-1]
                for idx in top_idx:
                    cls_name = self._class_names[idx] if idx < len(self._class_names) else ""
                    confidence = float(top_scores[idx])
                    if confidence < 0.5:
                        continue
                    if cls_name in self.ALERT_CLASSES:
                        tipo, severidad = self.ALERT_CLASSES[cls_name]
                        cooldown_key = f"acoustic:{tipo}"
                        now = time.time()
                        last = self._alert_cooldowns.get(cooldown_key, 0)
                        if now - last < 30:
                            continue
                        self._alert_cooldowns[cooldown_key] = now
                        self._save_and_notify(cls_name, tipo, severidad, confidence)
        except Exception as e:
            log.error(f"Error en loop acústico: {e}")

    def _save_and_notify(self, clase: str, tipo: str, severidad: str, confianza: float):
        conn = get_db()
        try:
            conn.execute(
                "INSERT INTO acoustic_events (clase, confianza) VALUES (?,?)",
                (clase, confianza),
            )
            conn.commit()
        finally:
            conn.close()
        log.warning(f"EVENTO ACÚSTICO: {tipo} ({confianza:.0%})")
        payload = {
            "tipo_alerta": f"ACUSTICO_{tipo}",
            "severidad": severidad,
            "descripcion": f"Evento acústico detectado: {clase} ({confianza:.0%})",
            "camera_id": "MICROFONO_LOCAL",
        }
        try:
            requests.post(f"{CONFIG.backend_ext_url}/ext/alertas-ia",
                          json=payload, timeout=3)
        except Exception:
            pass
        socketio.emit("acoustic_alert", {
            "tipo": tipo,
            "clase": clase,
            "confianza": f"{confianza:.0%}",
            "severidad": severidad,
            "timestamp": datetime.now().isoformat(),
        })

    def process_mqtt_event(self, evento: Dict):
        """Procesa evento acústico recibido desde hardware via MQTT"""
        clase = evento.get("clase", "")
        confianza = float(evento.get("confianza", 0.9))
        if clase in self.ALERT_CLASSES:
            tipo, severidad = self.ALERT_CLASSES[clase]
            self._save_and_notify(clase, tipo, severidad, confianza)


# ─── Gestión de cámaras ───────────────────────────────────────────────────────
class CameraStream:
    """Maneja el stream de una cámara individual"""

    def __init__(self, cam_id: str, rtsp_url: str, comunidad_id: Optional[str],
                 face_engine: "FaceEngine"):
        self.cam_id = cam_id
        self.rtsp_url = rtsp_url
        self.comunidad_id = comunidad_id
        self.face_engine = face_engine
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._frame_count = 0
        self._last_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self.online = False
        self.fps = 0

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"cam-{self.cam_id}")
        self._thread.start()
        log.info(f"Cámara {self.cam_id} iniciada: {self.rtsp_url}")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def get_frame(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._frame_count, self._last_frame

    def _loop(self):
        """Loop principal de captura y procesamiento"""
        cap = None
        reconnect_wait = 3

        while self._running:
            try:
                if cap is None or not cap.isOpened():
                    cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    if not cap.isOpened():
                        log.warning(f"No se pudo conectar a {self.cam_id}, reintentando en {reconnect_wait}s")
                        self.online = False
                        time.sleep(reconnect_wait)
                        continue

                self.online = True
                t0 = time.time()
                ret, frame = cap.read()
                if not ret:
                    log.warning(f"Frame perdido en {self.cam_id}")
                    cap.release()
                    cap = None
                    self.online = False
                    time.sleep(2)
                    continue

                self._frame_count += 1
                self.fps = round(1.0 / max(time.time() - t0, 0.001))

                # Redimensionar para procesamiento
                h, w = frame.shape[:2]
                if w > CONFIG.main_imgsz:
                    scale = CONFIG.main_imgsz / w
                    frame = cv2.resize(frame, (CONFIG.main_imgsz, int(h * scale)))

                with self._lock:
                    self._last_frame = frame.copy()

                # Procesar cada N frames
                if self._frame_count % CONFIG.process_every_n == 0 and CONFIG.face_enabled:
                    self._process_frame(frame)

                # Emitir frame vía SocketIO
                if self._frame_count % max(1, int(30 / CONFIG.max_stream_fps)) == 0:
                    self._emit_frame(frame)

            except Exception as e:
                log.error(f"Error en cámara {self.cam_id}: {e}")
                if cap:
                    cap.release()
                    cap = None
                self.online = False
                time.sleep(reconnect_wait)

        if cap:
            cap.release()
        self.online = False

    def _process_frame(self, frame: np.ndarray):
        """Detecta personas, procesa rostros (FaceEngine), placas (ALPR) y comportamiento"""
        try:
            from ultralytics import YOLO
        except ImportError:
            log.warning("ultralytics no instalado — detección deshabilitada")
            return

        try:
            model = _get_yolo_model()
            if model is None:
                return

            # ─ Detección de personas (clase 0) ──────────────────────────────
            results_persons = model(frame, conf=CONFIG.person_confidence,
                                    imgsz=CONFIG.main_imgsz, classes=[0], verbose=False)
            ba = get_behavior_analyzer()
            for r in results_persons:
                if r.boxes is None:
                    continue
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    h = y2 - y1
                    # Cabeza: 65% superior
                    head_y2 = y1 + int(h * 0.65)
                    head_crop = frame[max(0, y1):head_y2, max(0, x1):x2]
                    if head_crop.size > 0:
                        self.face_engine.process_roi(
                            self.cam_id, self.comunidad_id, head_crop, frame
                        )
                    # Centro del bbox para análisis de comportamiento
                    cx = (x1 + x2) // 2
                    cy = (y1 + y2) // 2
                    # Usar posición como track ID aproximado (cluster por posición)
                    track_id = f"T{cx//50}_{cy//50}"
                    ba.update(track_id, cx, cy, self.cam_id, self.comunidad_id)

            # ─ Detección de vehículos + ALPR ────────────────────────────────
            if CONFIG.alpr_enabled:
                get_plate_recognizer().process_frame(frame, self.cam_id, self.comunidad_id)

        except Exception as e:
            log.debug(f"Error procesando frame {self.cam_id}: {e}")

    def _emit_frame(self, frame: np.ndarray):
        """Codifica y emite frame via SocketIO"""
        try:
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, CONFIG.stream_quality])
            b64 = base64.b64encode(buf).decode()
            socketio.emit("camera_frame", {"camera_id": self.cam_id, "frame": b64})
        except Exception:
            pass


# ─── Singleton YOLO model ──────────────────────────────────────────────────────
_yolo_model = None
_yolo_lock = threading.Lock()

def _get_yolo_model():
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    with _yolo_lock:
        if _yolo_model is not None:
            return _yolo_model
        try:
            from ultralytics import YOLO
            model_path = MODELS_DIR / CONFIG.yolo_model
            if not model_path.exists():
                # Descargar automáticamente
                log.info(f"Descargando modelo YOLO: {CONFIG.yolo_model}")
                model_path = CONFIG.yolo_model  # ultralytics lo descarga automáticamente
            _yolo_model = YOLO(str(model_path))
            log.info(f"Modelo YOLO cargado: {CONFIG.yolo_model}")
        except Exception as e:
            log.error(f"Error cargando YOLO: {e}")
            return None
    return _yolo_model


# ─── Gestor de cámaras ────────────────────────────────────────────────────────
class CameraManager:
    def __init__(self, face_engine: FaceEngine):
        self.face_engine = face_engine
        self._cameras: Dict[str, CameraStream] = {}
        self._load_from_db()

    def _load_from_db(self):
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT id, nombre, rtsp_url, comunidad_id FROM cameras WHERE activa=1"
            ).fetchall()
            for row in rows:
                self._add_stream(row["id"], row["rtsp_url"], row["comunidad_id"])
        finally:
            conn.close()

    def _add_stream(self, cam_id: str, rtsp_url: str, comunidad_id: Optional[str]):
        if cam_id in self._cameras:
            self._cameras[cam_id].stop()
        stream = CameraStream(cam_id, rtsp_url, comunidad_id, self.face_engine)
        self._cameras[cam_id] = stream
        stream.start()

    def add_camera(self, cam_id: str, nombre: str, rtsp_url: str,
                   comunidad_id: Optional[str], lat: Optional[float],
                   lng: Optional[float]) -> Dict:
        conn = get_db()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO cameras (id, nombre, rtsp_url, comunidad_id, lat, lng) "
                "VALUES (?,?,?,?,?,?)",
                (cam_id, nombre, rtsp_url, comunidad_id, lat, lng),
            )
            conn.commit()
        finally:
            conn.close()
        self._add_stream(cam_id, rtsp_url, comunidad_id)
        return {"id": cam_id, "nombre": nombre, "rtsp_url": rtsp_url}

    def remove_camera(self, cam_id: str):
        if cam_id in self._cameras:
            self._cameras[cam_id].stop()
            del self._cameras[cam_id]
        conn = get_db()
        try:
            conn.execute("UPDATE cameras SET activa=0 WHERE id=?", (cam_id,))
            conn.commit()
        finally:
            conn.close()

    def list_cameras(self) -> List[Dict]:
        conn = get_db()
        try:
            rows = conn.execute(
                "SELECT id, nombre, rtsp_url, comunidad_id, lat, lng FROM cameras WHERE activa=1"
            ).fetchall()
            result = []
            for row in rows:
                cam_id = row["id"]
                stream = self._cameras.get(cam_id)
                result.append({
                    "id": cam_id,
                    "nombre": row["nombre"],
                    "rtsp_url": row["rtsp_url"],
                    "comunidad_id": row["comunidad_id"],
                    "lat": row["lat"],
                    "lng": row["lng"],
                    "online": stream.online if stream else False,
                })
            return result
        finally:
            conn.close()

    def get_frame(self, cam_id: str) -> Optional[np.ndarray]:
        stream = self._cameras.get(cam_id)
        if stream:
            _, frame = stream.get_frame()
            return frame
        return None


# ─── Flask Application ────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["SECRET_KEY"] = os.urandom(24).hex()
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Singletons
face_engine: Optional[FaceEngine] = None
camera_manager: Optional[CameraManager] = None
plate_recognizer: Optional[PlateRecognizer] = None
behavior_analyzer: Optional[BehaviorAnalyzer] = None
acoustic_detector: Optional[AcousticDetector] = None


def get_face_engine() -> FaceEngine:
    global face_engine
    if face_engine is None:
        face_engine = FaceEngine()
    return face_engine


def get_plate_recognizer() -> PlateRecognizer:
    global plate_recognizer
    if plate_recognizer is None:
        plate_recognizer = PlateRecognizer()
    return plate_recognizer


def get_behavior_analyzer() -> BehaviorAnalyzer:
    global behavior_analyzer
    if behavior_analyzer is None:
        behavior_analyzer = BehaviorAnalyzer()
    return behavior_analyzer


def get_acoustic_detector() -> AcousticDetector:
    global acoustic_detector
    if acoustic_detector is None:
        acoustic_detector = AcousticDetector()
    return acoustic_detector


def get_camera_manager() -> CameraManager:
    global camera_manager
    if camera_manager is None:
        camera_manager = CameraManager(get_face_engine())
    return camera_manager


# ─── Helpers ──────────────────────────────────────────────────────────────────
def paginate(rows: List, page: int = 1, limit: int = 20) -> Dict:
    total = len(rows)
    start = (page - 1) * limit
    end = start + limit
    return {
        "data": rows[start:end],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit),
    }


def row_to_dict(row) -> Dict:
    return dict(row) if row else {}


# ─── API: Cámaras ─────────────────────────────────────────────────────────────
@app.route("/api/cameras", methods=["GET"])
def api_list_cameras():
    return jsonify(get_camera_manager().list_cameras())


@app.route("/api/cameras/add", methods=["POST"])
def api_add_camera():
    data = request.json or {}
    cam_id = data.get("id") or f"cam_{uuid.uuid4().hex[:8]}"
    nombre = data.get("nombre", cam_id)
    rtsp_url = data.get("rtsp_url", "")
    comunidad_id = data.get("comunidad_id")
    lat = data.get("lat")
    lng = data.get("lng")
    if not rtsp_url:
        return jsonify({"error": "rtsp_url requerido"}), 400
    result = get_camera_manager().add_camera(cam_id, nombre, rtsp_url, comunidad_id, lat, lng)
    return jsonify(result), 201


@app.route("/api/cameras/remove", methods=["POST"])
def api_remove_camera():
    cam_id = (request.json or {}).get("id")
    if not cam_id:
        return jsonify({"error": "id requerido"}), 400
    get_camera_manager().remove_camera(cam_id)
    return jsonify({"ok": True})


@app.route("/api/cameras/<cam_id>/snapshot", methods=["GET"])
def api_snapshot(cam_id: str):
    frame = get_camera_manager().get_frame(cam_id)
    if frame is None:
        return jsonify({"error": "Cámara no disponible"}), 404
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return send_file(io.BytesIO(buf.tobytes()), mimetype="image/jpeg")


# ─── API: Identidades de rostros ──────────────────────────────────────────────
@app.route("/api/faces", methods=["GET"])
def api_list_faces():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    search = request.args.get("q", "")
    conn = get_db()
    try:
        if search:
            rows = conn.execute(
                "SELECT id, face_track_id, snapshot_path, camera_id, comunidad_id, "
                "first_seen, last_seen, detection_count, label FROM face_identities "
                "WHERE face_track_id LIKE ? OR label LIKE ? ORDER BY last_seen DESC",
                (f"%{search}%", f"%{search}%"),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, face_track_id, snapshot_path, camera_id, comunidad_id, "
                "first_seen, last_seen, detection_count, label FROM face_identities "
                "ORDER BY last_seen DESC"
            ).fetchall()
        items = [row_to_dict(r) for r in rows]
        return jsonify(paginate(items, page, limit))
    finally:
        conn.close()


@app.route("/api/faces/search", methods=["POST"])
def api_search_face():
    """Busca rostro por imagen subida"""
    if "image" not in request.files:
        return jsonify({"error": "imagen requerida"}), 400
    file = request.files["image"]
    img_bytes = file.read()
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"error": "imagen inválida"}), 400

    emb = get_face_engine().generate_embedding_from_image(img)
    if emb is None:
        return jsonify({"error": "No se detectó rostro en la imagen"}), 422

    emb_arr = np.array(emb, dtype=np.float32)
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, face_track_id, embedding, snapshot_path, camera_id, "
            "comunidad_id, first_seen, last_seen, detection_count, label "
            "FROM face_identities"
        ).fetchall()
        results = []
        for row in rows:
            row_emb = np.array(json.loads(row["embedding"]), dtype=np.float32)
            dist = FaceEngine._cosine_distance(emb_arr, row_emb)
            if dist < CONFIG.face_threshold:
                d = row_to_dict(row)
                d.pop("embedding", None)
                d["similitud"] = round(1.0 - dist, 4)
                results.append(d)
        results.sort(key=lambda x: x["similitud"], reverse=True)
        return jsonify(results[:10])
    finally:
        conn.close()


@app.route("/api/faces/<int:face_id>/label", methods=["PATCH"])
def api_label_face(face_id: int):
    label = (request.json or {}).get("label", "")
    conn = get_db()
    try:
        conn.execute("UPDATE face_identities SET label=? WHERE id=?", (label, face_id))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True})


# ─── API: Expedientes ─────────────────────────────────────────────────────────
@app.route("/api/expedientes", methods=["GET"])
def api_list_expedientes():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, nombre, descripcion, tipo, estado, photo_path, notas, "
            "alerta_nivel, created_at, backend_id FROM expedientes ORDER BY created_at DESC"
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    finally:
        conn.close()


@app.route("/api/expedientes", methods=["POST"])
def api_create_expediente():
    """Crea expediente con foto (genera embedding automáticamente)"""
    nombre = request.form.get("nombre", "Desconocido")
    descripcion = request.form.get("descripcion", "")
    tipo = request.form.get("tipo", "SOSPECHOSO")
    alerta_nivel = request.form.get("alerta_nivel", "ALTA")
    notas = request.form.get("notas", "")
    backend_id = request.form.get("backend_id")

    embedding_json = None
    photo_path = None

    if "foto" in request.files:
        file = request.files["foto"]
        img_bytes = file.read()
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is not None:
            emb = get_face_engine().generate_embedding_from_image(img)
            if emb:
                embedding_json = json.dumps(emb)
            # Guardar foto
            fname = f"exp_{uuid.uuid4().hex[:12]}.jpg"
            photo_path = str(EXPEDIENTES_DIR / fname)
            cv2.imwrite(photo_path, img)

    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO expedientes (nombre, descripcion, tipo, estado, embedding, "
            "photo_path, notas, alerta_nivel, backend_id) VALUES (?,?,?,?,?,?,?,?,?)",
            (nombre, descripcion, tipo, "ACTIVO", embedding_json,
             photo_path, notas, alerta_nivel, backend_id),
        )
        conn.commit()
        exp_id = cur.lastrowid
        get_face_engine().reload_expedientes()
        row = conn.execute("SELECT * FROM expedientes WHERE id=?", (exp_id,)).fetchone()
        d = row_to_dict(row)
        d.pop("embedding", None)
        return jsonify(d), 201
    finally:
        conn.close()


@app.route("/api/expedientes/<int:exp_id>", methods=["GET"])
def api_get_expediente(exp_id: int):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id, nombre, descripcion, tipo, estado, photo_path, notas, "
            "alerta_nivel, created_at, backend_id FROM expedientes WHERE id=?", (exp_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "No encontrado"}), 404
        return jsonify(row_to_dict(row))
    finally:
        conn.close()


@app.route("/api/expedientes/<int:exp_id>", methods=["DELETE"])
def api_delete_expediente(exp_id: int):
    conn = get_db()
    try:
        conn.execute("UPDATE expedientes SET estado='INACTIVO' WHERE id=?", (exp_id,))
        conn.commit()
        get_face_engine().reload_expedientes()
    finally:
        conn.close()
    return jsonify({"ok": True})


@app.route("/api/expedientes/<int:exp_id>/foto", methods=["POST"])
def api_update_expediente_foto(exp_id: int):
    """Actualiza la foto y embedding de un expediente existente"""
    if "foto" not in request.files:
        return jsonify({"error": "foto requerida"}), 400
    file = request.files["foto"]
    img_bytes = file.read()
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return jsonify({"error": "imagen inválida"}), 400

    emb = get_face_engine().generate_embedding_from_image(img)
    if emb is None:
        return jsonify({"error": "No se detectó rostro"}), 422

    fname = f"exp_{exp_id}_{uuid.uuid4().hex[:8]}.jpg"
    photo_path = str(EXPEDIENTES_DIR / fname)
    cv2.imwrite(photo_path, img)

    conn = get_db()
    try:
        conn.execute(
            "UPDATE expedientes SET embedding=?, photo_path=? WHERE id=?",
            (json.dumps(emb), photo_path, exp_id),
        )
        conn.commit()
        get_face_engine().reload_expedientes()
    finally:
        conn.close()
    return jsonify({"ok": True, "photo_path": photo_path})


# ─── API: Alertas ─────────────────────────────────────────────────────────────
@app.route("/api/alerts", methods=["GET"])
def api_list_alerts():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    camera_id = request.args.get("camera_id")
    alert_type = request.args.get("tipo")

    conn = get_db()
    try:
        query = ("SELECT id, timestamp, camera_id, comunidad_id, alert_type, severity, "
                 "descripcion, face_track_id, expediente_id, similitud, snapshot_path "
                 "FROM alerts WHERE 1=1")
        params = []
        if camera_id:
            query += " AND camera_id=?"
            params.append(camera_id)
        if alert_type:
            query += " AND alert_type=?"
            params.append(alert_type)
        query += " ORDER BY timestamp DESC"
        rows = conn.execute(query, params).fetchall()
        items = [row_to_dict(r) for r in rows]
        return jsonify(paginate(items, page, limit))
    finally:
        conn.close()


# ─── API: Stats ───────────────────────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
def api_stats():
    conn = get_db()
    try:
        total_camaras = conn.execute("SELECT COUNT(*) FROM cameras WHERE activa=1").fetchone()[0]
        total_identidades = conn.execute("SELECT COUNT(*) FROM face_identities").fetchone()[0]
        total_expedientes = conn.execute(
            "SELECT COUNT(*) FROM expedientes WHERE estado='ACTIVO'"
        ).fetchone()[0]
        total_alertas_hoy = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE date(timestamp)=date('now')"
        ).fetchone()[0]
        alertas_criticas = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE severity='CRITICA' AND date(timestamp)=date('now')"
        ).fetchone()[0]
        camaras_online = sum(
            1 for s in (camera_manager._cameras.values() if camera_manager else [])
            if s.online
        )
        return jsonify({
            "camaras": {"total": total_camaras, "online": camaras_online},
            "identidades": total_identidades,
            "expedientes": total_expedientes,
            "alertas_hoy": total_alertas_hoy,
            "alertas_criticas_hoy": alertas_criticas,
        })
    finally:
        conn.close()


# ─── API: Sincronización con WhatsEg ──────────────────────────────────────────
@app.route("/api/sync/cameras", methods=["POST"])
def api_sync_cameras():
    """
    Recibe lista de cámaras desde WhatsEg backend-ext y las sincroniza.
    Body: [{ id, nombre, rtsp_url, comunidad_id, lat, lng }]
    """
    cameras = request.json or []
    added = 0
    for cam in cameras:
        if cam.get("rtsp_url"):
            get_camera_manager().add_camera(
                cam_id=cam["id"],
                nombre=cam.get("nombre", cam["id"]),
                rtsp_url=cam["rtsp_url"],
                comunidad_id=cam.get("comunidad_id"),
                lat=cam.get("lat"),
                lng=cam.get("lng"),
            )
            added += 1
    return jsonify({"added": added})


# ─── API: ALPR — Placas vehiculares ───────────────────────────────────────────
@app.route("/api/plates", methods=["GET"])
def api_list_plates():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 30))
    denegada = request.args.get("denegada")
    conn = get_db()
    try:
        q = ("SELECT id, timestamp, camera_id, comunidad_id, placa, confianza, "
             "denegada, snapshot_path FROM plate_detections WHERE 1=1")
        params: List[Any] = []
        if denegada is not None:
            q += " AND denegada=?"
            params.append(1 if denegada.lower() == "true" else 0)
        q += " ORDER BY timestamp DESC"
        rows = conn.execute(q, params).fetchall()
        items = [row_to_dict(r) for r in rows]
        return jsonify(paginate(items, page, limit))
    finally:
        conn.close()


@app.route("/api/plates/denied", methods=["GET"])
def api_list_denied():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT placa, nivel, descripcion, activa FROM placas_denegadas_local"
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    finally:
        conn.close()


@app.route("/api/plates/denied/sync", methods=["POST"])
def api_sync_denied():
    """Recibe lista negra desde backend-ext y actualiza caché local"""
    placas = request.json or []  # [{placa, nivel, descripcion}]
    conn = get_db()
    try:
        conn.execute("UPDATE placas_denegadas_local SET activa=0")
        for p in placas:
            placa = PlateRecognizer.normalize_plate(p.get("placa", ""))
            if not placa:
                continue
            conn.execute(
                "INSERT OR REPLACE INTO placas_denegadas_local (placa, nivel, descripcion, activa) "
                "VALUES (?,?,?,1)",
                (placa, p.get("nivel", "MEDIA"), p.get("descripcion", "")),
            )
        conn.commit()
    finally:
        conn.close()
    get_plate_recognizer().reload_denied_list()
    return jsonify({"ok": True, "synced": len(placas)})


# ─── API: Comportamiento ───────────────────────────────────────────────────────
@app.route("/api/behavior", methods=["GET"])
def api_list_behavior():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, timestamp, camera_id, comunidad_id, tipo, duracion_seg, "
            "track_ids, snapshot_path FROM behavior_alerts ORDER BY timestamp DESC"
        ).fetchall()
        items = [row_to_dict(r) for r in rows]
        return jsonify(paginate(items, page, limit))
    finally:
        conn.close()


# ─── API: Eventos acústicos ────────────────────────────────────────────────────
@app.route("/api/acoustic", methods=["GET"])
def api_list_acoustic():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, timestamp, clase, confianza, fuente FROM acoustic_events "
            "ORDER BY timestamp DESC LIMIT 50"
        ).fetchall()
        return jsonify([row_to_dict(r) for r in rows])
    finally:
        conn.close()


@app.route("/api/acoustic/mqtt-event", methods=["POST"])
def api_acoustic_mqtt():
    """Recibe evento acústico desde hardware vía MQTT (bridgeado por backend-ext)"""
    get_acoustic_detector().process_mqtt_event(request.json or {})
    return jsonify({"ok": True})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok", "service": "whatseg-vision", "version": "2.0.0",
        "features": {
            "face_recognition": CONFIG.face_enabled,
            "alpr": CONFIG.alpr_enabled,
            "behavior": CONFIG.behavior_enabled,
            "acoustic": CONFIG.acoustic_enabled,
        },
    })


# ─── SocketIO Events ──────────────────────────────────────────────────────────
@socketio.on("connect")
def on_connect():
    log.debug("Cliente SocketIO conectado")
    emit("connected", {"status": "ok"})


@socketio.on("subscribe_camera")
def on_subscribe_camera(data):
    cam_id = data.get("camera_id", "")
    log.debug(f"Cliente suscrito a cámara: {cam_id}")


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("=" * 60)
    log.info("WhatsEg Vision Service v2.0")
    log.info(f"Puerto: {CONFIG.port}")
    log.info(f"YOLO: {CONFIG.yolo_model} | Rostros: {CONFIG.face_model}")
    log.info(f"ALPR: {'ON' if CONFIG.alpr_enabled else 'OFF'} | "
             f"Comportamiento: {'ON' if CONFIG.behavior_enabled else 'OFF'} | "
             f"Acústico: {'ON' if CONFIG.acoustic_enabled else 'OFF'}")
    log.info("=" * 60)

    init_db()

    # Inicializar motores en background
    fe = get_face_engine()
    pr = get_plate_recognizer()
    ba = get_behavior_analyzer()
    ad = get_acoustic_detector()
    cm = get_camera_manager()

    log.info(f"Cámaras activas: {len(cm.list_cameras())}")
    log.info("Servidor iniciado. Ctrl+C para detener.")

    import eventlet
    eventlet.wsgi.server(
        eventlet.listen(("0.0.0.0", CONFIG.port)),
        app,
        log=logging.getLogger("eventlet"),
    )
