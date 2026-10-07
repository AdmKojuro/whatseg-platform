import 'dart:ui';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// ─── Plugin de notificaciones locales ────────────────────────────────────────

final _notifPlugin = FlutterLocalNotificationsPlugin();
bool _notifInitialized = false;

Future<void> initNotifications() async {
  if (_notifInitialized) return;
  const android = AndroidInitializationSettings('@mipmap/ic_launcher');
  await _notifPlugin.initialize(
    const InitializationSettings(android: android),
  );
  _notifInitialized = true;
}

Future<void> showReportNotification({
  required String title,
  required String body,
}) async {
  await initNotifications();
  const androidDetails = AndroidNotificationDetails(
    'ptt_reportes',
    'Reportes PTT',
    channelDescription: 'Notificaciones de reportes y alertas',
    importance: Importance.high,
    priority: Priority.high,
    playSound: true,
    enableVibration: true,
  );
  await _notifPlugin.show(
    DateTime.now().millisecondsSinceEpoch ~/ 1000,
    title,
    body,
    const NotificationDetails(android: androidDetails),
  );
}

// ─── Foreground Task (mantiene el proceso vivo en segundo plano) ──────────────

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(_PttTaskHandler());
}

class _PttTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    // El WebSocket ya está manejado en el isolate principal.
    // El foreground task solo mantiene el proceso vivo.
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    // Keepalive — el servicio hace ping periódico en el isolate principal
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {}
}

// ─── API pública ──────────────────────────────────────────────────────────────

void initForegroundTask() {
  FlutterForegroundTask.init(
    androidNotificationOptions: AndroidNotificationOptions(
      channelId: 'ptt_foreground',
      channelName: 'WhatsEg PTT Activo',
      channelDescription: 'WhatsEg PTT está activo y recibiendo reportes',
      channelImportance: NotificationChannelImportance.LOW,
      priority: NotificationPriority.LOW,
    ),
    iosNotificationOptions: const IOSNotificationOptions(
      showNotification: true,
      playSound: false,
    ),
    foregroundTaskOptions: ForegroundTaskOptions(
      eventAction: ForegroundTaskEventAction.repeat(300000), // 5 min in ms
      autoRunOnBoot: true,
      allowWakeLock: true,
    ),
  );
}

Future<void> startForegroundService() async {
  if (await FlutterForegroundTask.isRunningService) return;
  await FlutterForegroundTask.startService(
    serviceId: 1001,
    notificationTitle: 'WhatsEg PTT',
    notificationText: 'Recibiendo reportes en segundo plano',
    callback: startCallback,
  );
}

Future<void> stopForegroundService() async {
  await FlutterForegroundTask.stopService();
}

Future<void> updateForegroundNotification(String text) async {
  await FlutterForegroundTask.updateService(
    notificationTitle: 'WhatsEg PTT',
    notificationText: text,
  );
}
