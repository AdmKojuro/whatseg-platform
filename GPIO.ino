/*
 * WHATSEG - Firmware unificado (GPIO + MQTT)
 *
 * Control del relay por GPIO0 (activo en LOW).
 * LED integrado en GPIO2 (activo en LOW).
 *
 * Endpoints HTTP (compatibles con Aparca / sistemas externos):
 *   GET  /relay         -> Relay ON por N segundos (default 5)
 *   GET  /relay?time=10 -> Relay ON por 10s
 *   GET  /relay/on      -> Relay ON indefinido
 *   GET  /relay/off     -> Relay OFF
 *   GET  /deny          -> LED parpadeo rapido (acceso denegado)
 *   GET  /status        -> Estado JSON
 *
 * Endpoints internos (panel web):
 *   GET  /              -> Panel de configuracion
 *   POST /activar       -> Relay ON por N segundos
 *   POST /apagar        -> Relay OFF
 *   POST /guardar       -> Guardar WiFi en EEPROM
 *   POST /conectar      -> Conectar a WiFi guardado
 *   GET  /sharetext     -> Datos de integracion (texto)
 *   POST /reiniciar     -> Reiniciar dispositivo
 *
 * Comandos MQTT (topic: whatseg/<device_id>/cmd):
 *   relay_on, relay_on:5, relay_off, status, restart
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>

ESP8266WebServer server(80);
DNSServer dnsServer;

// ═══════════════════════════════════════════
//  CONFIGURACION HARDWARE
// ═══════════════════════════════════════════

// Relay en GPIO0, activo en LOW
#define RELAY_PIN   0
#define RELAY_ON    LOW
#define RELAY_OFF   HIGH

// LED integrado ESP-01S en GPIO2 (activo LOW)
#define LED_PIN     2
#define LED_ON      LOW
#define LED_OFF     HIGH

#define EEPROM_SIZE 128

// Tiempo por defecto del relay (segundos)
#define DEFAULT_RELAY_TIME 5

// Tiempo LED parpadeo "deny" (segundos)
#define DENY_LED_TIME 3

// ═══════════════════════════════════════════
//  DATOS WHATSEG / MQTT
// ═══════════════════════════════════════════

const char* device_id    = "whatseg-015";
const char* mqtt_server  = "187.77.5.214";
const int   mqtt_port    = 1883;
const char* mqtt_user    = "esp8266_device";
const char* mqtt_pass    = "63e5619c141239b4ccbb319d8e1e5c3a";

WiFiClient    wifiClient;
PubSubClient  mqttClient(wifiClient);

bool          mqttConectado     = false;
unsigned long mqttLastReconnect = 0;

// ── Heartbeat ──
unsigned long mqttLastHeartbeat = 0;
#define       HEARTBEAT_INTERVAL 25000  // Publica /status cada 25s


// ═══════════════════════════════════════════
//  ESTADO
// ═══════════════════════════════════════════

String savedSSID = "";
String savedPASS = "";
String apSSID    = "Whatseg";

bool          relayActivo = false;
unsigned long relayOffAt  = 0;

// Deny: parpadeo rapido del LED
bool          denyActive   = false;
unsigned long denyOffAt    = 0;
unsigned long denyBlinkAt  = 0;
bool          denyLedState = false;

// ── EEPROM ──

void writeStringToEEPROM(int addr, const String& data, int maxLen) {
  for (int i = 0; i < maxLen; i++) {
    EEPROM.write(addr + i, i < (int)data.length() ? data[i] : 0);
  }
}

String readStringFromEEPROM(int addr, int maxLen) {
  char data[maxLen + 1];
  for (int i = 0; i < maxLen; i++) data[i] = EEPROM.read(addr + i);
  data[maxLen] = '\0';
  return String(data);
}

void loadWifiFromEEPROM() {
  savedSSID = readStringFromEEPROM(0, 32);
  savedPASS = readStringFromEEPROM(32, 64);
  savedSSID.trim();
  savedPASS.trim();
  if (savedSSID.length() > 0 && (uint8_t)savedSSID[0] == 0xFF) savedSSID = "";
  if (savedPASS.length() > 0 && (uint8_t)savedPASS[0] == 0xFF) savedPASS = "";
}

// ── Relay (GPIO0) ──

void releOn() {
  denyActive = false;
  denyOffAt  = 0;
  digitalWrite(RELAY_PIN, RELAY_ON);
  relayActivo = true;
  digitalWrite(LED_PIN, LED_ON);
}

void releOff() {
  digitalWrite(RELAY_PIN, RELAY_OFF);
  relayActivo = false;
  digitalWrite(LED_PIN, LED_OFF);
}

// ── Utilidades ──

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
  return String(s / 3600) + "h " + String((s % 3600) / 60) + "m " + String(s % 60) + "s";
}

String topicBase() {
  return String("whatseg/") + device_id;
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
  msg += "Comandos MQTT: status, relay_on, relay_on:5, relay_off, restart\n";
  msg += "Endpoints HTTP: /relay, /relay/on, /relay/off, /deny, /status\n";
  msg += "Estado rele: " + relayStatusText() + "\n";
  msg += "Uptime: " + uptimeText() + "\n";
  return msg;
}

// ── WiFi ──

void conectarWifiGuardado() {
  if (savedSSID.length() == 0) return;
  WiFi.begin(savedSSID.c_str(), savedPASS.c_str());
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) delay(500);
}

// ══════════════════════════════════════════════
//  MQTT
// ══════════════════════════════════════════════

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String cmd = "";
  for (unsigned int i = 0; i < length; i++) cmd += (char)payload[i];
  cmd.trim();

  if (cmd == "relay_off") {
    releOff();
    relayOffAt = 0;

  } else if (cmd == "relay_on") {
    releOn();
    relayOffAt = 0;

  } else if (cmd.startsWith("relay_on:")) {
    int segundos = cmd.substring(9).toInt();
    if (segundos < 1) segundos = 1;
    if (segundos > 120) segundos = 120;
    releOn();
    relayOffAt = millis() + ((unsigned long)segundos * 1000UL);

  } else if (cmd == "restart") {
    delay(500);
    ESP.restart();

  } else if (cmd == "status") {
    String base = topicBase();
    String info = "ok|relay:" + relayStatusText() + "|uptime:" + uptimeText();
    mqttClient.publish((base + "/event").c_str(), info.c_str());
  }
}

void mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - mqttLastReconnect < 5000) return;
  mqttLastReconnect = now;

  String base = topicBase();
  String willTopic = base + "/will";
  String clientId = String("whatseg_") + device_id + "_" + String(millis());

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
    mqttClient.publish((base + "/status").c_str(), "online", false);
    mqttClient.subscribe((base + "/cmd").c_str(), 1);
  } else {
    mqttConectado = false;
  }
}

// ══════════════════════════════════════════════
//  ENDPOINTS API (compatibles con sistemas externos)
// ══════════════════════════════════════════════

void handleRelay() {
  int duration = DEFAULT_RELAY_TIME;
  if (server.hasArg("time")) {
    duration = server.arg("time").toInt();
    if (duration < 1) duration = 1;
    if (duration > 120) duration = 120;
  }
  releOn();
  relayOffAt = millis() + (duration * 1000UL);
  String msg = "{\"ok\":true,\"relay\":\"on\",\"duration\":" + String(duration) + "}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", msg);
}

void handleRelayOn() {
  releOn();
  relayOffAt = 0;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true,\"relay\":\"on\",\"duration\":\"indefinido\"}");
}

void handleRelayOff() {
  releOff();
  relayOffAt = 0;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true,\"relay\":\"off\"}");
}

void handleDeny() {
  int duration = DENY_LED_TIME;
  if (server.hasArg("time")) {
    duration = server.arg("time").toInt();
    if (duration < 1) duration = 1;
    if (duration > 10) duration = 10;
  }
  denyActive   = true;
  denyOffAt    = millis() + (duration * 1000UL);
  denyBlinkAt  = 0;
  denyLedState = false;
  String msg = "{\"ok\":true,\"led\":\"blink\",\"duration\":" + String(duration) + "}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", msg);
}

void handleStatus() {
  String status = relayActivo ? "on" : "off";
  unsigned long remaining = 0;
  if (relayActivo && relayOffAt > 0 && millis() < relayOffAt)
    remaining = (relayOffAt - millis()) / 1000;
  String msg = "{\"relay\":\"" + status +
               "\",\"remaining\":" + String(remaining) +
               ",\"mqtt\":\"" + mqttStatusText() +
               "\",\"ip\":\"" + WiFi.localIP().toString() +
               "\",\"rssi\":" + String(WiFi.RSSI()) +
               ",\"uptime\":\"" + uptimeText() + "\"}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", msg);
}

// ══════════════════════════════════════════════
//  ENDPOINTS PANEL WEB
// ══════════════════════════════════════════════

void handleGuardar() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  ssid.trim(); pass.trim();
  writeStringToEEPROM(0, ssid, 32);
  writeStringToEEPROM(32, pass, 64);
  EEPROM.commit();
  savedSSID = ssid;
  savedPASS = pass;
  server.send(200, "text/plain", "WiFi guardado correctamente.");
}

void handleConectar() {
  WiFi.disconnect();
  delay(500);
  conectarWifiGuardado();
  if (WiFi.status() == WL_CONNECTED) {
    server.send(200, "text/plain", "Conectado a " + savedSSID + " - IP: " + WiFi.localIP().toString());
  } else {
    server.send(200, "text/plain", "No se pudo conectar a " + savedSSID);
  }
}

void handleActivar() {
  int segundos = server.arg("segundos").toInt();
  if (segundos < 1) segundos = 1;
  if (segundos > 120) segundos = 120;
  releOn();
  relayOffAt = millis() + ((unsigned long)segundos * 1000UL);
  server.send(200, "text/plain", "OK");
}

void handleApagar() {
  releOff();
  relayOffAt = 0;
  server.send(200, "text/plain", "OK");
}

void handleShareText() { server.send(200, "text/plain", buildShareText()); }

void handleReiniciar() {
  server.send(200, "text/plain", "Reiniciando...");
  delay(1000);
  ESP.restart();
}

// ── Panel Web ──

void handleRoot() {
  String base = topicBase();
  String html = "";

  html += "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Whatseg</title>";
  html += "<style>";
  html += "*{box-sizing:border-box}";
  html += "body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0f;color:#e8ecf4;margin:0;}";
  html += ".w{max-width:440px;margin:auto;padding:12px;}";
  html += ".c{background:#1a1a22;border:1px solid #2a2a35;border-radius:12px;padding:14px;margin-bottom:10px;}";
  html += ".hdr{text-align:center;padding:18px 14px;}";
  html += "h1{margin:6px 0 0;font-size:1.4rem;letter-spacing:1px;} h1 .w1{color:#00d68f;} h1 .w2{color:#ff4757;}";
  html += ".sub{text-align:center;color:#555e73;font-size:11px;margin:4px 0 0;}";
  html += ".r{margin:5px 0;font-size:13px;display:flex;justify-content:space-between;align-items:center;}";
  html += ".r b{color:#8892a8;}";
  html += ".tag{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;}";
  html += ".tag-on{background:rgba(0,214,143,.15);color:#00d68f;border:1px solid rgba(0,214,143,.3);}";
  html += ".tag-off{background:rgba(255,71,87,.12);color:#ff4757;border:1px solid rgba(255,71,87,.25);}";
  html += "label{display:block;font-size:11px;color:#555e73;margin:8px 0 3px;text-transform:uppercase;letter-spacing:.5px;}";
  html += "input,select{width:100%;padding:10px;border:1px solid #2a2a35;border-radius:8px;background:#111118;color:#e8ecf4;font-size:13px;}";
  html += "button{width:100%;padding:11px;border:none;border-radius:8px;font-weight:bold;font-size:13px;cursor:pointer;margin-top:6px;}";
  html += ".bg{background:#00d68f;color:#111;} .br{background:#ff4757;color:#fff;} .bx{background:#2a2a35;color:#8892a8;} .bb{background:#2563eb;color:#fff;}";
  html += ".btns{display:flex;gap:6px;} .btns button{flex:1;}";
  html += ".sep{border:0;border-top:1px solid #2a2a35;margin:10px 0;}";
  html += ".info{font-size:11px;color:#555e73;line-height:1.6;} .info b{color:#8892a8;} .info .hl{color:#00d68f;}";
  html += "</style>";

  html += "<script>";
  html += "async function gw(){var s=document.getElementById('ssid').value;var p=document.getElementById('pass').value;";
  html += "let r=await fetch('/guardar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p)});";
  html += "alert(await r.text());location.reload();}";
  html += "async function cw(){let r=await fetch('/conectar',{method:'POST'});alert(await r.text());location.reload();}";
  html += "async function activar(){var s=document.getElementById('seg').value;let body='segundos='+encodeURIComponent(s);await fetch('/activar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body});location.reload();}";
  html += "async function apagar(){await fetch('/apagar',{method:'POST'});location.reload();}";
  html += "async function dn(){await fetch('/deny');location.reload();}";
  html += "async function compartir(){let r=await fetch('/sharetext');let t=await r.text();if(navigator.share){try{await navigator.share({title:'WHATSEG',text:t});}catch(e){}}else{window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');}}";
  html += "async function rst(){if(confirm('Reiniciar dispositivo?')){await fetch('/reiniciar',{method:'POST'});alert('Reiniciando...');}}";
  html += "</script>";

  html += "</head><body><div class='w'>";

  // Header
  html += "<div class='c hdr'>";
  html += "<h1><span class='w1'>WHAT</span><span class='w2'>SEG</span></h1>";
  html += "<div class='sub'>GPIO Mode &bull; " + String(device_id) + "</div>";
  html += "<div class='sub'>AP: " + apSSID + " &bull; " + WiFi.softAPIP().toString() + "</div>";
  html += "</div>";

  // Estado
  html += "<div class='c'>";
  html += "<div class='r'><b>WiFi</b>";
  html += WiFi.status() == WL_CONNECTED ? "<span class='tag tag-on'>Conectado</span>" : "<span class='tag tag-off'>Desconectado</span>";
  html += "</div>";
  html += "<div class='r'><b>SSID</b><span>" + (WiFi.status() == WL_CONNECTED ? WiFi.SSID() : savedSSID) + "</span></div>";
  html += "<div class='r'><b>IP Local</b><span style='color:#00d68f;'>" + WiFi.localIP().toString() + "</span></div>";
  html += "<div class='r'><b>MAC</b><span>" + WiFi.macAddress() + "</span></div>";
  html += "<div class='r'><b>RSSI</b><span>" + rssiText() + "</span></div>";
  html += "<hr class='sep'>";
  html += "<div class='r'><b>MQTT</b>";
  html += mqttConectado ? "<span class='tag tag-on'>Conectado</span>" : "<span class='tag tag-off'>Desconectado</span>";
  html += "</div>";
  html += "<div class='r'><b>Relay (GPIO0)</b>";
  html += relayActivo ? "<span class='tag tag-on'>ACTIVO</span>" : "<span class='tag tag-off'>Reposo</span>";
  html += "</div>";
  html += "<div class='r'><b>Uptime</b><span>" + uptimeText() + "</span></div>";
  html += "</div>";

  // Config WiFi
  html += "<div class='c'>";
  html += "<label>SSID</label><input id='ssid' value='" + savedSSID + "'>";
  html += "<label>Contrasena</label><input id='pass' type='password' value='" + savedPASS + "'>";
  html += "<button class='bg' onclick='gw()'>Guardar WiFi</button>";
  html += "<button class='bx' onclick='cw()'>Conectar ahora</button>";
  html += "</div>";

  // Control Relay
  html += "<div class='c'>";
  html += "<label>Tiempo del relay (segundos)</label>";
  html += "<input id='seg' type='number' min='1' max='120' value='5'>";
  html += "<div class='btns'>";
  html += "<button class='bg' onclick='activar()'>ACTIVAR</button>";
  html += "<button class='bx' onclick='apagar()'>APAGAR</button>";
  html += "</div>";
  html += "<button class='br' style='margin-top:8px;' onclick='dn()'>DENEGAR (LED parpadeo)</button>";
  html += "</div>";

  // Info integracion
  html += "<div class='c'><div class='info'>";
  html += "<b>Integracion MQTT:</b><br>";
  html += "Broker: <span class='hl'>" + String(mqtt_server) + ":" + String(mqtt_port) + "</span><br>";
  html += "Topic cmd: <span class='hl'>" + base + "/cmd</span><br>";
  html += "Topic event: <span class='hl'>" + base + "/event</span><br>";
  html += "Comandos: relay_on, relay_on:5, relay_off, status, restart";
  html += "<hr class='sep'>";
  html += "<b>Integracion HTTP:</b><br>";
  html += "GET <span class='hl'>/relay</span> &rarr; Activar relay (" + String(DEFAULT_RELAY_TIME) + "s)<br>";
  html += "GET <span class='hl'>/relay?time=N</span> &rarr; Activar N seg<br>";
  html += "GET <span class='hl'>/relay/on</span> &rarr; Relay ON indefinido<br>";
  html += "GET <span class='hl'>/relay/off</span> &rarr; Relay OFF<br>";
  html += "GET <span class='hl'>/deny</span> &rarr; LED parpadeo (denegado)<br>";
  html += "GET <span class='hl'>/status</span> &rarr; Estado JSON";
  html += "</div>";
  html += "<br><button class='bb' onclick='compartir()'>Compartir datos</button>";
  html += "</div>";

  // Reiniciar
  html += "<div class='c'><button class='br' onclick='rst()'>Reiniciar dispositivo</button></div>";

  html += "</div></body></html>";
  server.send(200, "text/html", html);
}

// ══════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════

void setup() {
  // Relay GPIO0 — configurar ANTES de todo para evitar pulso espurio
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);

  // LED integrado
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_OFF);

  delay(200);

  EEPROM.begin(EEPROM_SIZE);

  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_AP_STA);
  delay(1000);

  // SSID unico por Chip ID: Whatseg-XXXX
  uint32_t chipId = ESP.getChipId();
  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%04X", (uint16_t)(chipId & 0xFFFF));
  apSSID = "Whatseg-" + String(suffix);
  WiFi.softAP(apSSID.c_str(), "12345678");

  // DNS captive portal
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", WiFi.softAPIP());

  // Cargar WiFi desde EEPROM
  loadWifiFromEEPROM();
  if (savedSSID.length() > 0) {
    conectarWifiGuardado();
  }

  // Feedback visual: 3 parpadeos si conecta WiFi
  if (WiFi.status() == WL_CONNECTED) {
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, LED_ON);  delay(100);
      digitalWrite(LED_PIN, LED_OFF); delay(100);
    }
  }

  // MQTT
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(30);
  mqttClient.setSocketTimeout(10);

  // Rutas API (sistemas externos)
  server.on("/relay",     HTTP_GET,  handleRelay);
  server.on("/relay/on",  HTTP_GET,  handleRelayOn);
  server.on("/relay/off", HTTP_GET,  handleRelayOff);
  server.on("/deny",      HTTP_GET,  handleDeny);
  server.on("/status",    HTTP_GET,  handleStatus);

  // Rutas panel web
  server.on("/",          HTTP_GET,  handleRoot);
  server.on("/activar",   HTTP_POST, handleActivar);
  server.on("/apagar",    HTTP_POST, handleApagar);
  server.on("/guardar",   HTTP_POST, handleGuardar);
  server.on("/conectar",  HTTP_POST, handleConectar);
  server.on("/sharetext", HTTP_GET,  handleShareText);
  server.on("/reiniciar", HTTP_POST, handleReiniciar);

  // Captive portal: redirigir URLs desconocidas al panel
  server.onNotFound([]() {
    server.sendHeader("Location", "http://" + WiFi.softAPIP().toString(), true);
    server.send(302, "text/plain", "");
  });

  server.begin();
}

// ══════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════

void loop() {
  dnsServer.processNextRequest();
  server.handleClient();

  // MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      mqttConectado = false;
      mqttReconnect();
    } else {
      mqttClient.loop();
      // Heartbeat: publica /status cada 25s para que el backend detecte online
      unsigned long now = millis();
      if (now - mqttLastHeartbeat >= HEARTBEAT_INTERVAL) {
        mqttLastHeartbeat = now;
        String info = "online|relay:" + relayStatusText() + "|uptime:" + uptimeText() + "|rssi:" + rssiText();
        mqttClient.publish((topicBase() + "/status").c_str(), info.c_str(), false);
      }
    }
  }

  // Auto-apagar relay cuando vence el tiempo
  if (relayActivo && relayOffAt > 0 && millis() >= relayOffAt) {
    releOff();
    relayOffAt = 0;
  }

  // Parpadeo LED durante "deny"
  if (denyActive) {
    if (millis() >= denyOffAt) {
      denyActive   = false;
      denyLedState = false;
      digitalWrite(LED_PIN, relayActivo ? LED_ON : LED_OFF);
    } else {
      if (millis() - denyBlinkAt >= 150) {
        denyBlinkAt  = millis();
        denyLedState = !denyLedState;
        digitalWrite(LED_PIN, denyLedState ? LED_ON : LED_OFF);
      }
    }
  }

  // LED estado: parpadeo lento si no hay WiFi (cuando relay off y no deny)
  if (!relayActivo && !denyActive) {
    static unsigned long tBlink = 0;
    static bool          bState = false;
    if (WiFi.status() != WL_CONNECTED) {
      if (millis() - tBlink >= 1000) {
        tBlink = millis();
        bState = !bState;
        digitalWrite(LED_PIN, bState ? LED_ON : LED_OFF);
      }
    } else {
      digitalWrite(LED_PIN, LED_OFF);
    }
  }
}
