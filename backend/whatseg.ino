#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>

ESP8266WebServer server(80);

// GPIO2 como LED de estado WiFi (evita conflicto con Serial/TX del rele)
// LED activo en LOW: LOW = encendido, HIGH = apagado
#define LED_WIFI 2
#define EEPROM_SIZE 128

String savedSSID = "";
String savedPASS = "";

bool relayActivo = false;
unsigned long relayStartedAt = 0;
unsigned long relayDuration  = 0;

// ===== DATOS WHATSEG =====
const char* device_id  = "whatseg-013";
const char* mqtt_server = "187.77.5.214";
const int   mqtt_port   = 1883;
const char* mqtt_user   = "esp8266_device";
const char* mqtt_pass   = "63e5619c141239b4ccbb319d8e1e5c3a";

// ===== MQTT =====
WiFiClient    wifiClient;
PubSubClient  mqttClient(wifiClient);

bool          mqttConectado     = false;
unsigned long mqttLastReconnect = 0;
unsigned long mqttBackoff       = 5000;  // Backoff inicial 5s, sube hasta 30s
#define       MQTT_BACKOFF_MAX  30000

// ===== WiFi reconnect =====
unsigned long wifiLastReconnect   = 0;
unsigned long wifiDisconnectedAt  = 0;
bool          wifiWasConnected    = false;
#define       WIFI_RECONNECT_INTERVAL  30000  // Reintentar WiFi cada 30s
#define       WIFI_RESTART_TIMEOUT    300000  // Reiniciar ESP si WiFi cae >5 min

// ===== Heartbeat =====
unsigned long lastHeartbeat = 0;
#define       HEARTBEAT_INTERVAL 25000  // Publica status cada 25s

// ===== WiFi scan cache =====
String cachedNetworkOptions = "";
unsigned long lastScanTime  = 0;
#define       SCAN_CACHE_MS 30000  // Cache de scan 30s

// ---------------- Control del Rele por Serial (STC15) ----------------
void releOn() {
  Serial.write(0xA0);
  Serial.write(0x01);
  Serial.write(0x01);
  Serial.write(0xA2);
  relayActivo = true;
}

void releOff() {
  Serial.write(0xA0);
  Serial.write(0x01);
  Serial.write(0x00);
  Serial.write(0xA1);
  relayActivo = false;
}

// ---------------- EEPROM ----------------
void writeStringToEEPROM(int addr, const String& data, int maxLen) {
  for (int i = 0; i < maxLen; i++) {
    EEPROM.write(addr + i, i < (int)data.length() ? data[i] : 0);
  }
}

String readStringFromEEPROM(int addr, int maxLen) {
  String result = "";
  for (int i = 0; i < maxLen; i++) {
    char c = EEPROM.read(addr + i);
    if (c == 0) break;                         // Null terminator
    if (c < 32 || c > 126) break;              // Solo caracteres imprimibles ASCII
    result += c;
  }
  return result;
}

// ---------------- Utilidades ----------------
String wifiStatusText() {
  return WiFi.status() == WL_CONNECTED ? "Conectado" : "No conectado";
}

String mqttStatusText() {
  return mqttConectado ? "Conectado" : "Desconectado";
}

String relayStatusText() {
  return relayActivo ? "Encendido" : "Apagado";
}

String rssiText() {
  if (WiFi.status() != WL_CONNECTED) return "-- dBm";
  return String(WiFi.RSSI()) + " dBm";
}

String uptimeText() {
  unsigned long s = millis() / 1000;
  unsigned long h = s / 3600;
  unsigned long m = (s % 3600) / 60;
  unsigned long sec = s % 60;
  return String(h) + "h " + String(m) + "m " + String(sec) + "s";
}

String topicBase() {
  return String("whatseg/") + device_id;
}

String availableNetworksOptions() {
  // Usar cache si es reciente
  unsigned long now = millis();
  if (cachedNetworkOptions.length() > 0 && (now - lastScanTime) < SCAN_CACHE_MS) {
    return cachedNetworkOptions;
  }

  String out = "<option value=''>Selecciona una red...</option>";
  int n = WiFi.scanNetworks();
  yield();
  if (n > 0) {
    for (int i = 0; i < n; i++) {
      String ssid = WiFi.SSID(i);
      if (!ssid.length()) continue;
      out += "<option value='";
      out += ssid;
      out += "'";
      if (ssid == savedSSID) out += " selected";
      out += ">";
      out += ssid;
      out += " (";
      out += WiFi.RSSI(i);
      out += " dBm)";
      out += "</option>";
      yield();
    }
  }
  WiFi.scanDelete();

  cachedNetworkOptions = out;
  lastScanTime = now;
  return out;
}

String buildShareText() {
  String base = topicBase();
  String msg = "";
  msg += "WHATSEG - DATOS DE INTEGRACION\n";
  msg += "----------------------------------\n";
  msg += "Device ID: " + String(device_id) + "\n";
  msg += "Estado WiFi: " + wifiStatusText() + "\n";
  msg += "SSID guardado: " + savedSSID + "\n";
  msg += "SSID conectado: " + WiFi.SSID() + "\n";
  msg += "IP local: " + WiFi.localIP().toString() + "\n";
  msg += "IP AP: " + WiFi.softAPIP().toString() + "\n";
  msg += "MAC: " + WiFi.macAddress() + "\n";
  msg += "RSSI: " + rssiText() + "\n";
  msg += "Estado MQTT: " + mqttStatusText() + "\n";
  msg += "Broker MQTT: " + String(mqtt_server) + "\n";
  msg += "Puerto MQTT: " + String(mqtt_port) + "\n";
  msg += "Usuario MQTT: " + String(mqtt_user) + "\n";
  msg += "Topic base: " + base + "\n";
  msg += "Topic status: " + base + "/status\n";
  msg += "Topic event: " + base + "/event\n";
  msg += "Topic cmd: " + base + "/cmd\n";
  msg += "Comandos soportados: status, relay_on, relay_on:5, relay_off, restart\n";
  msg += "Estado rele: " + relayStatusText() + "\n";
  msg += "Uptime: " + uptimeText() + "\n";
  return msg;
}

// ---------------- MQTT Callback ----------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String cmd = "";
  for (unsigned int i = 0; i < length; i++) {
    cmd += (char)payload[i];
  }
  cmd.trim();

  if (cmd == "relay_off") {
    releOff();
    relayDuration = 0;
    relayStartedAt = 0;

  } else if (cmd == "relay_on") {
    releOn();
    relayDuration = 0;
    relayStartedAt = 0;

  } else if (cmd.startsWith("relay_on:")) {
    int segundos = cmd.substring(9).toInt();
    if (segundos < 1) segundos = 1;
    if (segundos > 120) segundos = 120;
    releOn();
    relayStartedAt = millis();
    relayDuration = (unsigned long)segundos * 1000UL;

  } else if (cmd == "restart") {
    delay(500);
    ESP.restart();

  } else if (cmd == "status") {
    String base = topicBase();
    String info = "ok|relay:" + relayStatusText() + "|uptime:" + uptimeText() +
                  "|rssi:" + rssiText() + "|heap:" + String(ESP.getFreeHeap());
    mqttClient.publish((base + "/event").c_str(), info.c_str());
  }
}

// ---------------- MQTT Reconexion con backoff ----------------
void mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) {
    mqttConectado = true;
    return;
  }

  unsigned long now = millis();
  if ((now - mqttLastReconnect) < mqttBackoff) return;
  mqttLastReconnect = now;

  String base = topicBase();
  String willTopic = base + "/will";
  String clientId = String("whatseg_") + device_id + "_" + String(now % 100000);

  bool ok = mqttClient.connect(
    clientId.c_str(),
    mqtt_user,
    mqtt_pass,
    willTopic.c_str(),
    1,
    true,
    "offline"
  );

  if (ok) {
    mqttConectado = true;
    mqttBackoff = 5000;  // Reset backoff al conectar
    mqttClient.publish((base + "/status").c_str(), "online", false);
    mqttClient.subscribe((base + "/cmd").c_str(), 1);
  } else {
    mqttConectado = false;
    // Backoff exponencial: 5s -> 10s -> 20s -> 30s (max)
    mqttBackoff = min(mqttBackoff * 2, (unsigned long)MQTT_BACKOFF_MAX);
  }
}

// ---------------- WiFi reconexion automatica ----------------
void wifiReconnectCheck() {
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    wifiWasConnected = true;
    wifiDisconnectedAt = 0;
    return;
  }

  // WiFi esta desconectado

  // Registrar cuando empezo la desconexion
  if (wifiDisconnectedAt == 0) {
    wifiDisconnectedAt = now;
  }

  // Si lleva mas de 5 minutos sin WiFi, reiniciar el ESP
  if ((now - wifiDisconnectedAt) > WIFI_RESTART_TIMEOUT && savedSSID.length() > 0) {
    ESP.restart();
  }

  // Intentar reconectar cada 30 segundos
  if ((now - wifiLastReconnect) < WIFI_RECONNECT_INTERVAL) return;
  wifiLastReconnect = now;

  if (savedSSID.length() == 0) return;

  WiFi.disconnect(false);
  delay(100);
  yield();
  WiFi.begin(savedSSID.c_str(), savedPASS.c_str());

  // Esperar hasta 10 segundos (no bloqueante total: usa yield)
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 10000) {
    delay(250);
    yield();
    server.handleClient();  // Seguir atendiendo el AP mientras espera
  }
}

// ---------------- WiFi externo (solo para setup) ----------------
void conectarWifiGuardado() {
  if (savedSSID.length() == 0) return;

  WiFi.begin(savedSSID.c_str(), savedPASS.c_str());

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 15000) {
    delay(500);
    yield();
  }
}

// ---------------- Heartbeat MQTT ----------------
void mqttHeartbeat() {
  if (!mqttConectado || !mqttClient.connected()) return;

  unsigned long now = millis();
  if ((now - lastHeartbeat) < HEARTBEAT_INTERVAL) return;
  lastHeartbeat = now;

  String base = topicBase();
  String status = "online|uptime:" + uptimeText() + "|rssi:" + rssiText() +
                  "|heap:" + String(ESP.getFreeHeap()) +
                  "|relay:" + relayStatusText();
  mqttClient.publish((base + "/status").c_str(), status.c_str(), false);
}

// ---------------- Web ----------------
String page(String mensaje = "") {
  String base = topicBase();
  String html = "";

  html += "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Whatseg</title>";
  html += "<style>";
  html += "body{font-family:Arial;background:#f4f7f4;margin:0;color:#222;}";
  html += ".w{max-width:420px;margin:auto;padding:12px;}";
  html += ".c{background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;}";
  html += "h1{margin:0;text-align:center;color:#0e8e2e;} h1 span{color:#d60000;}";
  html += ".s{text-align:center;color:#666;font-size:12px;margin-top:4px;}";
  html += ".r{margin:6px 0;font-size:14px;word-break:break-word;}";
  html += ".l{display:block;font-size:12px;color:#666;margin-bottom:4px;}";
  html += "input,select{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;margin-bottom:8px;}";
  html += "button{width:100%;padding:11px;border:none;border-radius:8px;color:#fff;font-weight:bold;}";
  html += ".g{background:#0e8e2e;} .x{background:#666;} .d{background:#d60000;} .b{background:#2563eb;}";
  html += ".m{background:#ecfdf3;border:1px solid #bbf7d0;color:#065f46;border-radius:8px;padding:8px;font-size:13px;}";
  html += ".on{color:#16a34a;font-weight:bold;} .off{color:#dc2626;font-weight:bold;}";
  html += ".mini{font-size:12px;color:#555;word-break:break-word;}";
  html += "</style>";

  html += "<script>";
  html += "function copiarSSID(){var s=document.getElementById('ssid_list');var t=document.getElementById('ssid');if(s&&t&&s.value!=''){t.value=s.value;}}";
  html += "async function guardarWifi(){var ssid=document.getElementById('ssid').value;var pass=document.getElementById('pass').value;var body='ssid='+encodeURIComponent(ssid)+'&pass='+encodeURIComponent(pass);let r=await fetch('/guardar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body});alert(await r.text());location.reload();}";
  html += "async function probarConexion(){let r=await fetch('/conectar',{method:'POST'});alert(await r.text());location.reload();}";
  html += "async function activarRele(){var s=document.getElementById('segundos').value;let body='segundos='+encodeURIComponent(s);await fetch('/activar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body});location.reload();}";
  html += "async function apagarRele(){await fetch('/apagar',{method:'POST'});location.reload();}";
  html += "async function reiniciarEquipo(){if(!confirm('Reiniciar dispositivo?')) return;await fetch('/reiniciar',{method:'POST'});alert('Reiniciando...');}";
  html += "async function compartirInfo(){let r=await fetch('/sharetext');let t=await r.text();if(navigator.share){try{await navigator.share({title:'WHATSEG',text:t});}catch(e){}}else{window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');}}";
  html += "</script>";

  html += "</head><body><div class='w'>";
  html += "<div class='c'><h1>WHAT<span>SEG</span></h1>";
  html += "<div class='s'>Panel interno</div>";
  html += "<div class='s'>AP: Whatseg / 192.168.4.1</div>";
  if (mensaje.length()) html += "<div class='m'>" + mensaje + "</div>";
  html += "</div>";

  html += "<div class='c'>";
  html += "<div class='r'><b>Estado WiFi:</b> " + wifiStatusText() + "</div>";
  html += "<div class='r'><b>SSID guardado:</b> " + savedSSID + "</div>";
  html += "<div class='r'><b>SSID conectado:</b> " + WiFi.SSID() + "</div>";
  html += "<div class='r'><b>IP local:</b> " + WiFi.localIP().toString() + "</div>";
  html += "<div class='r'><b>IP AP:</b> " + WiFi.softAPIP().toString() + "</div>";
  html += "<div class='r'><b>MAC:</b> " + WiFi.macAddress() + "</div>";
  html += "<div class='r'><b>RSSI:</b> " + rssiText() + "</div>";
  html += "<div class='r'><b>Estado MQTT:</b> ";
  html += mqttConectado ? "<span class='on'>Conectado</span>" : "<span class='off'>Desconectado</span>";
  html += "</div>";
  html += "<div class='r'><b>Rele:</b> ";
  html += relayActivo ? "<span class='on'>Encendido</span>" : "<span class='off'>Apagado</span>";
  html += "</div>";
  html += "<div class='r'><b>Uptime:</b> " + uptimeText() + "</div>";
  html += "<div class='r'><b>Heap libre:</b> " + String(ESP.getFreeHeap()) + " bytes</div>";
  html += "</div>";

  html += "<div class='c'>";
  html += "<div class='r'><b>Informacion de integracion</b></div>";
  html += "<div class='mini'>Device ID: " + String(device_id) + "</div>";
  html += "<div class='mini'>Broker MQTT: " + String(mqtt_server) + "</div>";
  html += "<div class='mini'>Puerto MQTT: " + String(mqtt_port) + "</div>";
  html += "<div class='mini'>Usuario MQTT: " + String(mqtt_user) + "</div>";
  html += "<div class='mini'>Topic base: " + base + "</div>";
  html += "<div class='mini'>Topic status: " + base + "/status</div>";
  html += "<div class='mini'>Topic event: " + base + "/event</div>";
  html += "<div class='mini'>Topic cmd: " + base + "/cmd</div>";
  html += "<div class='mini'>Comandos soportados: status, relay_on, relay_on:5, relay_off, restart</div>";
  html += "<br><button class='b' onclick='compartirInfo()'>Compartir</button>";
  html += "</div>";

  html += "<div class='c'>";
  html += "<label class='l'>Redes disponibles</label>";
  html += "<select id='ssid_list' onchange='copiarSSID()'>";
  html += availableNetworksOptions();
  html += "</select>";
  html += "<label class='l'>SSID</label>";
  html += "<input id='ssid' type='text' value='" + savedSSID + "'>";
  html += "<label class='l'>Contrasena</label>";
  html += "<input id='pass' type='password' value='" + savedPASS + "'>";
  html += "<button class='g' onclick='guardarWifi()'>Guardar WiFi</button>";
  html += "<br><br><button class='x' onclick='probarConexion()'>Conectar a WiFi</button>";
  html += "<br><br><button class='x' onclick='location.reload()'>Actualizar redes</button>";
  html += "</div>";

  html += "<div class='c'>";
  html += "<label class='l'>Tiempo del rele (segundos)</label>";
  html += "<input id='segundos' type='number' min='1' max='120' value='3'>";
  html += "<button class='g' onclick='activarRele()'>Activar rele</button>";
  html += "<br><br><button class='x' onclick='apagarRele()'>Apagar rele</button>";
  html += "</div>";

  html += "<div class='c'><button class='d' onclick='reiniciarEquipo()'>Reiniciar dispositivo</button></div>";
  html += "</div></body></html>";
  return html;
}

// ---------------- Rutas ----------------
void handleRoot() { server.send(200, "text/html", page()); }

void handleGuardar() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  ssid.trim(); pass.trim();
  writeStringToEEPROM(0, ssid, 32);
  writeStringToEEPROM(32, pass, 64);
  EEPROM.commit();
  savedSSID = ssid;
  savedPASS = pass;
  // Invalidar cache de scan
  cachedNetworkOptions = "";
  server.send(200, "text/plain", "WiFi guardado correctamente.");
}

void handleConectar() {
  WiFi.disconnect(false);
  delay(500);
  yield();

  if (savedSSID.length() == 0) {
    server.send(200, "text/plain", "No hay red WiFi guardada.");
    return;
  }

  WiFi.begin(savedSSID.c_str(), savedPASS.c_str());

  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - t0) < 10000) {
    delay(250);
    yield();
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiDisconnectedAt = 0;
    server.send(200, "text/plain", "Equipo conectado a la red WiFi.");
  } else {
    server.send(200, "text/plain", "No se pudo conectar a la red WiFi.");
  }
}

void handleActivar() {
  int segundos = server.arg("segundos").toInt();
  if (segundos < 1) segundos = 1;
  if (segundos > 120) segundos = 120;
  releOn();
  relayStartedAt = millis();
  relayDuration = (unsigned long)segundos * 1000UL;
  server.send(200, "text/plain", "OK");
}

void handleApagar() {
  releOff();
  relayStartedAt = 0;
  relayDuration = 0;
  server.send(200, "text/plain", "OK");
}

void handleShareText() { server.send(200, "text/plain", buildShareText()); }

void handleReiniciar() {
  server.send(200, "text/plain", "Reiniciando...");
  delay(1000);
  ESP.restart();
}

// ---------------- Setup / Loop ----------------
void setup() {
  // Serial controla el rele via STC15 — NO usar para debug
  Serial.begin(115200);
  delay(500);

  // Apagar rele al iniciar
  releOff();
  delay(200);

  EEPROM.begin(EEPROM_SIZE);

  // LED en GPIO2: activo en LOW
  // Conectado = HIGH (apagado), Desconectado = titila
  pinMode(LED_WIFI, OUTPUT);
  digitalWrite(LED_WIFI, HIGH); // Inicia apagado

  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(500);

  WiFi.mode(WIFI_AP_STA);
  WiFi.setAutoReconnect(true);    // Reconexion automatica del SDK
  WiFi.setAutoConnect(false);     // No auto-connect al boot (lo hacemos manual)
  delay(500);

  WiFi.softAP("Whatseg", "12345678");

  savedSSID = readStringFromEEPROM(0, 32);
  savedPASS = readStringFromEEPROM(32, 64);

  if (savedSSID.length() > 0) {
    conectarWifiGuardado();
    if (WiFi.status() == WL_CONNECTED) {
      wifiWasConnected = true;
    }
  }

  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(10);
  mqttClient.setBufferSize(512);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/guardar", HTTP_POST, handleGuardar);
  server.on("/conectar", HTTP_POST, handleConectar);
  server.on("/activar", HTTP_POST, handleActivar);
  server.on("/apagar", HTTP_POST, handleApagar);
  server.on("/sharetext", HTTP_GET, handleShareText);
  server.on("/reiniciar", HTTP_POST, handleReiniciar);

  server.begin();
}

void loop() {
  server.handleClient();
  yield();

  // Reconexion WiFi automatica si se pierde
  wifiReconnectCheck();

  // Gestion MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      mqttConectado = false;
      mqttReconnect();
    } else {
      mqttClient.loop();
      mqttHeartbeat();
    }
  } else {
    mqttConectado = false;
  }

  // Apagar rele cuando vence el tiempo (resistente a overflow de millis)
  if (relayActivo && relayDuration > 0 && relayStartedAt > 0) {
    if ((millis() - relayStartedAt) >= relayDuration) {
      releOff();
      relayStartedAt = 0;
      relayDuration = 0;
    }
  }

  // LED de estado WiFi (GPIO2, activo en LOW)
  // Conectado  -> LED apagado (HIGH)
  // Desconectado -> LED titila cada 500ms
  static unsigned long tBlink = 0;
  static bool ledState = false;

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_WIFI, HIGH); // Apagado
    ledState = false;
  } else {
    if ((millis() - tBlink) >= 500) {
      tBlink = millis();
      ledState = !ledState;
      digitalWrite(LED_WIFI, ledState ? LOW : HIGH); // Titila
    }
  }
}
