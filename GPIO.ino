/*
 * WHATSEG - Firmware GPIO (ESP-01S)
 *
 * Hardware:
 *   Relay: GPIO0 (activo en LOW)
 *   LED:   GPIO2 (activo en LOW)
 *
 * HTTP API (compatible con sistemas externos):
 *   GET  /relay          -> Relay ON por 5s (default)
 *   GET  /relay?time=N   -> Relay ON por N segundos
 *   GET  /relay/on       -> Relay ON indefinido
 *   GET  /relay/off      -> Relay OFF
 *   GET  /deny           -> LED parpadeo rapido (acceso denegado)
 *   GET  /status         -> Estado JSON
 *
 * Panel web interno:
 *   GET  /               -> Panel de configuracion
 *   POST /guardar        -> Guardar WiFi en EEPROM
 *   POST /conectar       -> Conectar a WiFi guardado
 *   POST /activar        -> Relay ON por N segundos
 *   POST /reiniciar      -> Reiniciar dispositivo
 *   GET  /sharetext      -> Datos de integracion (texto)
 *
 * MQTT (topic: whatseg/<device_id>/cmd):
 *   relay_on, relay_on:N, relay_off, status, restart
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <DNSServer.h>
#include <EEPROM.h>
#include <PubSubClient.h>

ESP8266WebServer server(80);
DNSServer        dnsServer;

// ═══════════════════════════════════════════
//  HARDWARE  (ESP-01S)
// ═══════════════════════════════════════════

#define RELAY_PIN   0     // GPIO0 — activo en LOW
#define RELAY_ON    LOW
#define RELAY_OFF   HIGH

#define LED_PIN     2     // GPIO2 — activo en LOW
#define LED_ON      LOW
#define LED_OFF     HIGH

#define EEPROM_SIZE 128

// ═══════════════════════════════════════════
//  DATOS WHATSEG / MQTT
// ═══════════════════════════════════════════

const char* device_id   = "whatseg-016";
const char* mqtt_server = "187.77.5.214";
const int   mqtt_port   = 1883;
const char* mqtt_user   = "esp8266_device";
const char* mqtt_pass   = "63e5619c141239b4ccbb319d8e1e5c3a";

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

bool          mqttConectado     = false;
unsigned long mqttLastReconnect = 0;
unsigned long mqttLastHeartbeat = 0;
#define       HEARTBEAT_INTERVAL 25000   // publica online cada 25s

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

// ── EEPROM ─────────────────────────────────

void writeStringToEEPROM(int addr, const String& data, int maxLen) {
  for (int i = 0; i < maxLen; i++)
    EEPROM.write(addr + i, i < (int)data.length() ? data[i] : 0);
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

// ── Relay ───────────────────────────────────

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

// ── Utilidades ─────────────────────────────

String wifiStatusText()  { return WiFi.status() == WL_CONNECTED ? "Conectado" : "No conectado"; }
String mqttStatusText()  { return mqttConectado ? "Conectado" : "Desconectado"; }
String relayStatusText() { return relayActivo ? "Encendido" : "Apagado"; }

String rssiText() {
  if (WiFi.status() != WL_CONNECTED) return "-- dBm";
  return String(WiFi.RSSI()) + " dBm";
}

String uptimeText() {
  unsigned long s = millis() / 1000;
  return String(s / 3600) + "h " + String((s % 3600) / 60) + "m " + String(s % 60) + "s";
}

String topicBase() { return String("whatseg/") + device_id; }

// Escaneo inline — se llama al cargar la pagina
String availableNetworksOptions() {
  String out = "<option value=''>-- selecciona una red --</option>";
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    String ssid = WiFi.SSID(i);
    if (!ssid.length()) continue;
    ssid.replace("'", "&#39;");
    out += "<option value='" + ssid + "'";
    if (ssid == savedSSID) out += " selected";
    out += ">" + ssid + " (" + String(WiFi.RSSI(i)) + "dBm)";
    if (WiFi.encryptionType(i) != ENC_TYPE_NONE) out += " [+]";
    out += "</option>";
  }
  WiFi.scanDelete();
  return out;
}

String buildShareText() {
  String base = topicBase();
  String msg  = "WHATSEG - DATOS DE INTEGRACION\n";
  msg += "----------------------------------\n";
  msg += "Device ID: "    + String(device_id)  + "\n";
  msg += "Estado WiFi: "  + wifiStatusText()    + "\n";
  msg += "SSID guardado: "+ savedSSID           + "\n";
  msg += "IP local: "     + WiFi.localIP().toString() + "\n";
  msg += "IP AP: "        + WiFi.softAPIP().toString() + "\n";
  msg += "MAC: "          + WiFi.macAddress()   + "\n";
  msg += "RSSI: "         + rssiText()          + "\n";
  msg += "Estado MQTT: "  + mqttStatusText()    + "\n";
  msg += "Broker MQTT: "  + String(mqtt_server) + ":" + String(mqtt_port) + "\n";
  msg += "Usuario MQTT: " + String(mqtt_user)   + "\n";
  msg += "Topic base: "   + base + "\n";
  msg += "Topic cmd: "    + base + "/cmd\n";
  msg += "Comandos: relay_on, relay_on:N, relay_off, status, restart\n";
  msg += "HTTP: /relay, /relay/on, /relay/off, /deny, /status\n";
  msg += "Estado relay: " + relayStatusText()   + "\n";
  msg += "Uptime: "       + uptimeText()        + "\n";
  return msg;
}

// ── WiFi ───────────────────────────────────

void conectarWifiGuardado() {
  if (savedSSID.length() == 0) return;
  WiFi.begin(savedSSID.c_str(), savedPASS.c_str());
  Serial.print("Conectando a: "); Serial.println(savedSSID);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("No conecto al WiFi externo");
  }
}

// ═══════════════════════════════════════════
//  MQTT
// ═══════════════════════════════════════════

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String cmd = "";
  for (unsigned int i = 0; i < length; i++) cmd += (char)payload[i];
  cmd.trim();
  Serial.print("[MQTT] cmd: "); Serial.println(cmd);

  if (cmd == "relay_off") {
    releOff();
    relayOffAt = 0;

  } else if (cmd == "relay_on") {
    releOn();
    relayOffAt = 0;

  } else if (cmd.startsWith("relay_on:")) {
    int seg = cmd.substring(9).toInt();
    if (seg < 1)   seg = 1;
    if (seg > 120) seg = 120;
    releOn();
    relayOffAt = millis() + ((unsigned long)seg * 1000UL);

  } else if (cmd == "restart") {
    delay(500);
    ESP.restart();

  } else if (cmd == "status") {
    String info = "ok|relay:" + relayStatusText() + "|uptime:" + uptimeText();
    mqttClient.publish((topicBase() + "/event").c_str(), info.c_str());
  }
}

void mqttReconnect() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;
  unsigned long now = millis();
  if (now - mqttLastReconnect < 5000) return;
  mqttLastReconnect = now;

  String base     = topicBase();
  String clientId = "whatseg_" + String(device_id) + "_" + String(millis());

  bool ok = mqttClient.connect(
    clientId.c_str(),
    mqtt_user, mqtt_pass,
    (base + "/will").c_str(), 1, true, "offline"
  );

  if (ok) {
    mqttConectado = true;
    Serial.println("[MQTT] Conectado");
    mqttClient.publish((base + "/status").c_str(), "online", false);
    mqttClient.subscribe((base + "/cmd").c_str(), 1);
  } else {
    mqttConectado = false;
    Serial.print("[MQTT] Error rc="); Serial.println(mqttClient.state());
  }
}

// ═══════════════════════════════════════════
//  HTTP API  (endpoints externos)
// ═══════════════════════════════════════════

void handleRelay() {
  int dur = 5;
  if (server.hasArg("time")) {
    dur = server.arg("time").toInt();
    if (dur < 1)   dur = 1;
    if (dur > 120) dur = 120;
  }
  releOn();
  relayOffAt = millis() + ((unsigned long)dur * 1000UL);
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json",
    "{\"ok\":true,\"relay\":\"on\",\"duration\":" + String(dur) + "}");
}

void handleRelayOn() {
  releOn(); relayOffAt = 0;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json",
    "{\"ok\":true,\"relay\":\"on\",\"duration\":\"indefinido\"}");
}

void handleRelayOff() {
  releOff(); relayOffAt = 0;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"ok\":true,\"relay\":\"off\"}");
}

void handleDeny() {
  int dur = 3;
  if (server.hasArg("time")) {
    dur = server.arg("time").toInt();
    if (dur < 1)  dur = 1;
    if (dur > 10) dur = 10;
  }
  denyActive   = true;
  denyOffAt    = millis() + ((unsigned long)dur * 1000UL);
  denyBlinkAt  = 0;
  denyLedState = false;
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json",
    "{\"ok\":true,\"led\":\"blink\",\"duration\":" + String(dur) + "}");
}

void handleStatusApi() {
  unsigned long remaining = 0;
  if (relayActivo && relayOffAt > 0 && millis() < relayOffAt)
    remaining = (relayOffAt - millis()) / 1000;
  String msg = "{\"relay\":\"" + String(relayActivo ? "on" : "off") +
               "\",\"remaining\":" + String(remaining) +
               ",\"mqtt\":\"" + mqttStatusText() +
               "\",\"ip\":\"" + WiFi.localIP().toString() +
               "\",\"rssi\":" + String(WiFi.RSSI()) +
               ",\"uptime\":\"" + uptimeText() + "\"}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", msg);
}

// ═══════════════════════════════════════════
//  PANEL WEB
// ═══════════════════════════════════════════

String page() {
  String base = topicBase();
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Whatseg</title><style>";
  html += "body{font-family:Arial;background:#f4f7f4;margin:0;color:#222;}";
  html += ".w{max-width:420px;margin:auto;padding:12px;}";
  html += ".c{background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px;margin-bottom:10px;}";
  html += "h1{margin:0;text-align:center;color:#0e8e2e;} h1 span{color:#d60000;}";
  html += ".s{text-align:center;color:#666;font-size:12px;margin-top:4px;}";
  html += ".r{margin:6px 0;font-size:14px;word-break:break-word;}";
  html += ".l{display:block;font-size:12px;color:#666;margin-bottom:4px;}";
  html += "input,select{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;";
  html += "margin-bottom:8px;box-sizing:border-box;font-size:14px;}";
  html += "button{width:100%;padding:11px;border:none;border-radius:8px;color:#fff;";
  html += "font-weight:bold;cursor:pointer;margin-bottom:6px;font-size:14px;}";
  html += ".g{background:#0e8e2e;} .x{background:#666;} .d{background:#d60000;} .b{background:#2563eb;}";
  html += ".on{color:#16a34a;font-weight:bold;} .off{color:#dc2626;font-weight:bold;}";
  html += ".mini{font-size:12px;color:#555;word-break:break-word;margin:2px 0;}";
  html += "</style><script>";

  html += "function copiarSSID(){";
  html += "var v=document.getElementById('ssid_list').value;";
  html += "if(v){document.getElementById('ssid').value=v;";
  html += "document.getElementById('pass').focus();}}";

  html += "async function guardarWifi(){";
  html += "var s=document.getElementById('ssid').value;";
  html += "var p=document.getElementById('pass').value;";
  html += "if(!s){alert('Ingresa el SSID');return;}";
  html += "let r=await fetch('/guardar',{method:'POST',";
  html += "headers:{'Content-Type':'application/x-www-form-urlencoded'},";
  html += "body:'ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p)});";
  html += "alert(await r.text());location.reload();}";

  html += "async function probarConexion(){";
  html += "let r=await fetch('/conectar',{method:'POST'});";
  html += "alert(await r.text());location.reload();}";

  html += "async function activarRele(){";
  html += "var s=document.getElementById('segundos').value;";
  html += "await fetch('/activar',{method:'POST',";
  html += "headers:{'Content-Type':'application/x-www-form-urlencoded'},";
  html += "body:'segundos='+encodeURIComponent(s)});location.reload();}";

  html += "async function reiniciarEquipo(){";
  html += "if(!confirm('Reiniciar dispositivo?'))return;";
  html += "await fetch('/reiniciar',{method:'POST'});alert('Reiniciando...');}";

  html += "async function compartirInfo(){";
  html += "let r=await fetch('/sharetext');let t=await r.text();";
  html += "if(navigator.share){try{await navigator.share({title:'WHATSEG',text:t});}catch(e){}}";
  html += "else{window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');}}";

  html += "</script></head><body><div class='w'>";

  // Header
  html += "<div class='c'>";
  html += "<h1>WHAT<span>SEG</span></h1>";
  html += "<div class='s'>GPIO Mode &bull; " + String(device_id) + "</div>";
  html += "<div class='s'>AP: " + apSSID + " &bull; 192.168.4.1</div>";
  html += "</div>";

  // Estado
  html += "<div class='c'>";
  html += "<div class='r'><b>WiFi:</b> " + wifiStatusText() + "</div>";
  html += "<div class='r'><b>SSID:</b> " + (WiFi.status() == WL_CONNECTED ? WiFi.SSID() : savedSSID) + "</div>";
  html += "<div class='r'><b>IP local:</b> " + WiFi.localIP().toString() + "</div>";
  html += "<div class='r'><b>MAC:</b> " + WiFi.macAddress() + "</div>";
  html += "<div class='r'><b>RSSI:</b> " + rssiText() + "</div>";
  html += "<div class='r'><b>MQTT:</b> ";
  html += mqttConectado ? "<span class='on'>Conectado</span>" : "<span class='off'>Desconectado</span>";
  html += "</div>";
  html += "<div class='r'><b>Relay (GPIO0):</b> ";
  html += relayActivo ? "<span class='on'>Encendido</span>" : "<span class='off'>Apagado</span>";
  html += "</div>";
  html += "<div class='r'><b>Uptime:</b> " + uptimeText() + "</div>";
  html += "</div>";

  // Integracion
  html += "<div class='c'>";
  html += "<div class='r'><b>Integracion MQTT</b></div>";
  html += "<div class='mini'>Broker: " + String(mqtt_server) + ":" + String(mqtt_port) + "</div>";
  html += "<div class='mini'>Topic cmd: " + base + "/cmd</div>";
  html += "<div class='mini'>Comandos: relay_on, relay_on:N, relay_off, status, restart</div>";
  html += "<div class='r' style='margin-top:8px;'><b>HTTP API</b></div>";
  html += "<div class='mini'>GET /relay?time=N &nbsp; GET /relay/on &nbsp; GET /relay/off</div>";
  html += "<div class='mini'>GET /status &nbsp; GET /deny</div>";
  html += "<br><button class='b' onclick='compartirInfo()'>Compartir datos</button>";
  html += "</div>";

  // Config WiFi
  html += "<div class='c'>";
  html += "<label class='l'>Redes disponibles</label>";
  html += "<select id='ssid_list' onchange='copiarSSID()'>";
  html += availableNetworksOptions();
  html += "</select>";
  html += "<label class='l'>SSID</label>";
  html += "<input id='ssid' type='text' placeholder='Nombre de la red' value='" + savedSSID + "'>";
  html += "<label class='l'>Contrasena</label>";
  html += "<input id='pass' type='password' placeholder='Contrasena WiFi'>";
  html += "<button class='g' onclick='guardarWifi()'>Guardar WiFi</button>";
  html += "<button class='x' onclick='probarConexion()'>Conectar a WiFi</button>";
  html += "<button class='x' onclick='location.reload()'>Actualizar redes</button>";
  html += "</div>";

  // Control relay
  html += "<div class='c'>";
  html += "<label class='l'>Tiempo del relay (segundos)</label>";
  html += "<input id='segundos' type='number' min='1' max='120' value='5'>";
  html += "<button class='g' onclick='activarRele()'>Activar relay</button>";
  html += "</div>";

  // Reiniciar
  html += "<div class='c'>";
  html += "<button class='d' onclick='reiniciarEquipo()'>Reiniciar dispositivo</button>";
  html += "</div>";

  html += "</div></body></html>";
  return html;
}

void handleRoot()      { server.send(200, "text/html", page()); }
void handleShareText() { server.send(200, "text/plain", buildShareText()); }

void handleGuardar() {
  String ssid = server.arg("ssid");
  String pass = server.arg("pass");
  ssid.trim(); pass.trim();
  writeStringToEEPROM(0,  ssid, 32);
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
  if (WiFi.status() == WL_CONNECTED)
    server.send(200, "text/plain",
      "Conectado a " + savedSSID + " - IP: " + WiFi.localIP().toString());
  else
    server.send(200, "text/plain", "No se pudo conectar a " + savedSSID);
}

void handleActivar() {
  int seg = server.arg("segundos").toInt();
  if (seg < 1)   seg = 1;
  if (seg > 120) seg = 120;
  releOn();
  relayOffAt = millis() + ((unsigned long)seg * 1000UL);
  server.send(200, "text/plain", "OK");
}

void handleReiniciar() {
  server.send(200, "text/plain", "Reiniciando...");
  delay(1000);
  ESP.restart();
}

// ═══════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  delay(500);

  // GPIO0: relay — configurar ANTES para evitar pulso espurio al boot
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);

  // GPIO2: LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_OFF);

  EEPROM.begin(EEPROM_SIZE);

  WiFi.persistent(false);
  WiFi.disconnect(true);
  delay(1000);
  WiFi.mode(WIFI_AP_STA);
  delay(1000);

  // AP con nombre unico por Chip ID
  uint32_t chipId = ESP.getChipId();
  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%04X", (uint16_t)(chipId & 0xFFFF));
  apSSID = "Whatseg-" + String(suffix);
  WiFi.softAP(apSSID.c_str(), "12345678");

  Serial.println("\n=== WHATSEG GPIO ===");
  Serial.print("AP: ");    Serial.println(apSSID);
  Serial.print("IP AP: "); Serial.println(WiFi.softAPIP());

  // DNS captive portal
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(53, "*", WiFi.softAPIP());

  // Cargar WiFi guardado y conectar
  loadWifiFromEEPROM();
  if (savedSSID.length() > 0) {
    Serial.println("Intentando conectar a WiFi guardado...");
    conectarWifiGuardado();
  } else {
    Serial.println("Sin WiFi guardado. Solo AP activo.");
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

  // Rutas HTTP API (sistemas externos)
  server.on("/relay",     HTTP_GET, handleRelay);
  server.on("/relay/on",  HTTP_GET, handleRelayOn);
  server.on("/relay/off", HTTP_GET, handleRelayOff);
  server.on("/deny",      HTTP_GET, handleDeny);
  server.on("/status",    HTTP_GET, handleStatusApi);

  // Rutas panel web
  server.on("/",          HTTP_GET,  handleRoot);
  server.on("/guardar",   HTTP_POST, handleGuardar);
  server.on("/conectar",  HTTP_POST, handleConectar);
  server.on("/activar",   HTTP_POST, handleActivar);
  server.on("/sharetext", HTTP_GET,  handleShareText);
  server.on("/reiniciar", HTTP_POST, handleReiniciar);

  // Captive portal
  server.onNotFound([]() {
    server.sendHeader("Location", "http://" + WiFi.softAPIP().toString(), true);
    server.send(302, "text/plain", "");
  });

  server.begin();
  Serial.println("Servidor iniciado en puerto 80");
}

// ═══════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════

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
      // Heartbeat: publica online cada 25s
      unsigned long now = millis();
      if (now - mqttLastHeartbeat >= HEARTBEAT_INTERVAL) {
        mqttLastHeartbeat = now;
        String info = "online|relay:" + relayStatusText() +
                      "|uptime:" + uptimeText() +
                      "|rssi:" + rssiText();
        mqttClient.publish((topicBase() + "/status").c_str(), info.c_str(), false);
      }
    }
  }

  // Auto-apagar relay cuando vence el tiempo
  if (relayActivo && relayOffAt > 0 && millis() >= relayOffAt) {
    releOff();
    relayOffAt = 0;
  }

  // Deny: parpadeo rapido del LED
  if (denyActive) {
    if (millis() >= denyOffAt) {
      denyActive   = false;
      denyLedState = false;
      digitalWrite(LED_PIN, relayActivo ? LED_ON : LED_OFF);
    } else if (millis() - denyBlinkAt >= 150) {
      denyBlinkAt  = millis();
      denyLedState = !denyLedState;
      digitalWrite(LED_PIN, denyLedState ? LED_ON : LED_OFF);
    }
  }

  // LED estado WiFi (parpadeo lento si sin WiFi, apagado si conectado)
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
