<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false, 'error' => 'Metodo no permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['ok' => false, 'error' => 'Datos invalidos']);
    exit;
}

$nombre = htmlspecialchars(trim($input['nombre'] ?? ''), ENT_QUOTES, 'UTF-8');
$email = filter_var(trim($input['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$telefono = htmlspecialchars(trim($input['telefono'] ?? ''), ENT_QUOTES, 'UTF-8');
$mensaje = htmlspecialchars(trim($input['mensaje'] ?? ''), ENT_QUOTES, 'UTF-8');

if (!$nombre || !$email || !$telefono) {
    echo json_encode(['ok' => false, 'error' => 'Faltan campos obligatorios']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['ok' => false, 'error' => 'Email invalido']);
    exit;
}

$to = 'Info@whatseg.com';
$subject = "=?UTF-8?B?" . base64_encode("Nuevo contacto de WhatSeg - $nombre") . "?=";

$waLink = "https://wa.me/" . preg_replace('/[^0-9]/', '', $telefono);
$fecha = date('d/m/Y H:i');

$body = '
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#25D366;font-size:22px;font-weight:800;letter-spacing:-0.5px;">WHAT<span style="color:#DC2626;">SEG</span></h1>
            <p style="margin:6px 0 0;color:#ffffff80;font-size:12px;">Nueva consulta desde la landing page</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <p style="margin:0 0 24px;color:#6B7280;font-size:13px;">' . $fecha . '</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:14px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;width:120px;color:#6B7280;font-size:13px;font-weight:600;">Nombre</td>
                <td style="padding:14px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">' . $nombre . '</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;width:120px;color:#6B7280;font-size:13px;font-weight:600;">Email</td>
                <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;"><a href="mailto:' . $email . '" style="color:#25D366;text-decoration:none;">' . $email . '</a></td>
              </tr>
              <tr>
                <td style="padding:14px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;width:120px;color:#6B7280;font-size:13px;font-weight:600;">Telefono</td>
                <td style="padding:14px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;">' . $telefono . '</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;width:120px;color:#6B7280;font-size:13px;font-weight:600;vertical-align:top;">Mensaje</td>
                <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;line-height:1.5;">' . ($mensaje ?: '<em style="color:#9ca3af;">Sin mensaje</em>') . '</td>
              </tr>
            </table>

            <!-- Action buttons -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td align="center" style="padding-right:8px;">
                  <a href="mailto:' . $email . '" style="display:inline-block;background-color:#0a0a0a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;">Responder por email</a>
                </td>
                <td align="center" style="padding-left:8px;">
                  <a href="' . $waLink . '" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:700;">Contactar por WhatsApp</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">Este mensaje fue enviado automaticamente desde whatseg.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>';

$headers = "From: noreply@whatseg.com\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['ok' => true]);
} else {
    echo json_encode(['ok' => false, 'error' => 'No se pudo enviar el email. Intenta mas tarde.']);
}
