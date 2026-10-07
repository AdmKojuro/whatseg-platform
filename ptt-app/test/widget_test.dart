import 'package:flutter_test/flutter_test.dart';
import 'package:whatseg_ptt/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const WhatsEgPttApp());
    expect(find.byType(WhatsEgPttApp), findsOneWidget);
  });
}
