<?php
// Réception des formulaires (étude, rappel en 1 clic) et envoi par email.
// L'adresse de destination est lue dans .form-config.php (hors dépôt, protégé par .htaccess).
declare(strict_types=1);

function back(string $query): void {
    $retour = (string)($_POST['_retour'] ?? '/');
    if (!preg_match('#^/[A-Za-z0-9/_\-]*$#', $retour) || str_starts_with($retour, '//')) $retour = '/';
    $ancre = preg_replace('/[^a-z]/', '', (string)($_POST['_ancre'] ?? ''));
    header('Location: ' . $retour . '?' . $query . ($ancre !== '' ? '#' . $ancre : ''), true, 303);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: /', true, 303); exit; }

$cfg = @include __DIR__ . '/.form-config.php';
$to = is_array($cfg) ? (string)($cfg['to'] ?? '') : '';
$from = is_array($cfg) ? (string)($cfg['from'] ?? '') : '';
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) back('contact_erreur=1');

// Anti-spam : champ piège rempli -> on fait comme si c'était envoyé
if (!empty($_POST['website'])) back('contact_posted=true&f=' . (($_POST['_ancre'] ?? '') === '' ? 'cb' : 'etude'));

$c = $_POST['contact'] ?? [];
if (!is_array($c)) back('contact_erreur=1');

$clean = static fn($v): string => trim(mb_substr(preg_replace('/[\r\n\t]+/', ' ', strip_tags((string)$v)), 0, 2000));
$email = $clean($c['email'] ?? '');
$tel = $clean($c['phone'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^[+0-9 .\-]{9,20}$/', $tel) || empty($c['Consentement RGPD'])) {
    back('contact_erreur=1');
}

$lignes = [];
foreach ($c as $k => $v) {
    if (is_array($v)) continue;
    $k = $clean($k); $v = $clean($v);
    if ($v === '' || $k === '') continue;
    if ($k === 'body') $k = 'Message';
    if ($k === 'phone') $k = 'Téléphone';
    if ($k === 'email') $k = 'Email';
    $lignes[] = $k . ' : ' . $v;
}
$type = $clean($c['Demande'] ?? 'Demande d\'étude');
$prenom = $clean($c['Prénom'] ?? '');
$sujet = '=?UTF-8?B?' . base64_encode('Nouvelle demande — ' . $type . ($prenom ? ' — ' . $prenom : '')) . '?=';
$corps = "Nouvelle demande reçue depuis le site.\n\n" . implode("\n", $lignes) . "\n\nDate : " . date('d/m/Y H:i') . "\n";

$host = preg_replace('/[^a-z0-9.\-]/i', '', explode(':', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'))[0]);
if (!filter_var($from, FILTER_VALIDATE_EMAIL)) $from = 'site@' . preg_replace('/^www\./', '', $host);
$headers = [
    'From: =?UTF-8?B?' . base64_encode('Site Énergie Hachem Yazour') . '?= <' . $from . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
$ok = @mail($to, $sujet, $corps, implode("\r\n", $headers), '-f' . $from);
back($ok ? 'contact_posted=true&f=' . (($_POST['_ancre'] ?? '') === '' ? 'cb' : 'etude') : 'contact_erreur=1');
