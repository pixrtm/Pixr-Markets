<?php
declare(strict_types=1);

function markets_site_root(): string
{
    $here = dirname(__DIR__);
    if (is_file($here . '/portal/lib.php')) {
        return $here;
    }
    $up = dirname($here);
    if (is_file($up . '/portal/lib.php')) {
        return $up;
    }
    return $here;
}

function markets_dir(): string
{
    return markets_site_root() . DIRECTORY_SEPARATOR . 'secret' . DIRECTORY_SEPARATOR . 'markets';
}

function markets_user_id(array $user): string
{
    $id = strtolower(trim((string)($user['id'] ?? '')));
    if (preg_match('/^[a-f0-9]{16,64}$/', $id) !== 1) {
        throw new RuntimeException('id');
    }
    return $id;
}

function markets_clip(string $value, int $max): string
{
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value) ?? '';
    $collapsed = preg_replace('/\s+/u', ' ', $value);
    $value = trim(is_string($collapsed) ? $collapsed : $value);
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

function markets_clean(array $data): array
{
    $favorites = [];
    foreach ((array)($data['favorites'] ?? []) as $id) {
        if (!is_string($id)) {
            continue;
        }
        $id = trim($id);
        if ($id === '' || preg_match('/^[A-Za-z0-9:^=.\\-]{1,80}$/', $id) !== 1 || strpos($id, '..') !== false) {
            continue;
        }
        $favorites[$id] = $id;
        if (count($favorites) >= 200) {
            break;
        }
    }
    $types = ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX', 'CRYPTOCURRENCY', 'CURRENCY'];
    $found = [];
    foreach ((array)($data['found'] ?? []) as $row) {
        if (!is_array($row) || count($found) >= 80) {
            continue;
        }
        $symbol = strtoupper(trim((string)($row['symbol'] ?? '')));
        if (preg_match('/^[A-Z0-9^=.\\-]{1,32}$/', $symbol) !== 1 || strpos($symbol, '..') !== false || preg_match('/^[.\\-]/', $symbol) === 1) {
            continue;
        }
        $type = strtoupper(preg_replace('/[^A-Za-z]/', '', (string)($row['quoteType'] ?? '')) ?? '');
        if (!in_array($type, $types, true)) {
            continue;
        }
        $found[] = [
            'symbol' => $symbol,
            'quoteType' => $type,
            'shortname' => markets_clip((string)($row['shortname'] ?? $symbol), 80),
            'exchDisp' => markets_clip((string)($row['exchDisp'] ?? ''), 40),
            'currency' => substr(preg_replace('/[^A-Za-z]/', '', (string)($row['currency'] ?? '')) ?? '', 0, 12),
        ];
    }
    $period = (string)($data['period'] ?? '1Y');
    if (!in_array($period, ['1M', '6M', '1Y', '5Y'], true)) {
        $period = '1Y';
    }
    return ['favorites' => array_values($favorites), 'found' => $found, 'period' => $period];
}

function markets_blank(): array
{
    return ['favorites' => [], 'found' => [], 'period' => '1Y'];
}

if (PHP_SAPI === 'cli' && basename((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) !== 'compte.php') {
    return;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
header('Referrer-Policy: same-origin');

function markets_out(array $payload, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$portal = markets_site_root() . '/portal/lib.php';
if (!is_file($portal)) {
    markets_out(['ok' => false, 'message' => 'Le compte Pixr n’est pas disponible sur ce serveur.'], 503);
}
require $portal;
pixr_portal_boot();

function markets_ensure_dir(): void
{
    $dir = markets_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('dir');
    }
    $ht = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\nOptions -Indexes\n");
    }
}

function markets_read(array $user): ?array
{
    $path = markets_dir() . DIRECTORY_SEPARATOR . markets_user_id($user) . '.json';
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return null;
    }
    return markets_clean($data);
}

function markets_write(array $user, array $state): void
{
    markets_ensure_dir();
    $dir = markets_dir();
    $path = $dir . DIRECTORY_SEPARATOR . markets_user_id($user) . '.json';
    $clean = markets_clean($state);
    $clean['updated'] = gmdate('c');
    $json = json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('encode');
    }
    $lock = fopen($dir . DIRECTORY_SEPARATOR . 'write.lock', 'c+');
    if ($lock === false) {
        throw new RuntimeException('lock');
    }
    try {
        if (!flock($lock, LOCK_EX)) {
            throw new RuntimeException('lock');
        }
        $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
            throw new RuntimeException('write');
        }
        if (!@rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('replace');
        }
        @chmod($path, 0600);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function markets_public_user(?array $user): ?array
{
    if ($user === null) {
        return null;
    }
    $picture = trim((string)($user['picture'] ?? ''));
    if (preg_match('#^https://#i', $picture) !== 1 || preg_match('/[\s<>"\']/', $picture) === 1 || strlen($picture) > 300) {
        $picture = '';
    }
    return [
        'name' => trim((string)($user['name'] ?? '')),
        'email' => trim((string)($user['email'] ?? '')),
        'picture' => $picture,
    ];
}

function markets_google(): string
{
    $id = trim((string)($_ENV['GOOGLE_OAUTH_CLIENT_ID'] ?? ''));
    if ($id === '' || !function_exists('pixr_portal_host')) {
        return '';
    }
    $host = pixr_portal_host();
    $continue = 'https://pixr.dev/pixr-markets/';
    if ($host === 'pixr.dev' || ($host !== '' && substr($host, -9) === '.pixr.dev')) {
        $continue = 'https://' . $host . '/pixr-markets/';
    }
    return 'https://cloud.pixr.dev/auth/google_start.php?continue=' . rawurlencode($continue);
}

function markets_body(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '' || strlen($raw) > 200000) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function markets_csrf_ok(array $body): bool
{
    $sent = (string)($body['csrf'] ?? '');
    $saved = (string)($_SESSION['pixr_portal_csrf'] ?? '');
    return $sent !== '' && $saved !== '' && hash_equals($saved, $sent);
}

function markets_state_payload(?array $user): array
{
    $state = markets_blank();
    $fresh = true;
    if ($user !== null) {
        $stored = markets_read($user);
        $fresh = $stored === null;
        $state = $stored ?? $state;
    }
    return [
        'ok' => $user !== null,
        'user' => markets_public_user($user),
        'csrf' => pixr_portal_csrf(),
        'google' => markets_google(),
        'state' => $user !== null ? $state : null,
        'fresh' => $user !== null ? $fresh : false,
    ];
}

$user = function_exists('pixr_portal_user') ? pixr_portal_user() : null;
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    try {
        markets_out(markets_state_payload($user));
    } catch (Throwable $e) {
        markets_out(['ok' => false, 'message' => 'La sélection du compte est illisible.'], 500);
    }
}

if ($method !== 'POST') {
    markets_out(['ok' => false, 'message' => 'Méthode refusée.'], 405);
}

$body = markets_body();
$action = strtolower(trim((string)($body['action'] ?? '')));
if (!markets_csrf_ok($body)) {
    markets_out(['ok' => false, 'message' => 'La page a expiré. Rechargez-la.'], 403);
}

if ($action === 'logout') {
    pixr_portal_logout();
    markets_out(['ok' => true, 'user' => null, 'csrf' => pixr_portal_csrf(), 'state' => null, 'fresh' => false]);
}

if ($action === 'login' || $action === 'register' || $action === 'verify' || $action === 'resend') {
    if (!pixr_portal_ready()) {
        markets_out(['ok' => false, 'message' => 'Les comptes Pixr sont indisponibles.'], 503);
    }
    $max = $action === 'login' ? 8 : 5;
    if (!pixr_portal_allow('markets-' . $action, $max, 900)) {
        markets_out(['ok' => false, 'message' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
    }
    if (trim((string)($body['website'] ?? '')) !== '') {
        markets_out(['ok' => false, 'message' => 'Email ou mot de passe incorrect.'], 400);
    }
    $email = pixr_portal_as_utf8(trim((string)($body['email'] ?? '')));
    if (($action === 'verify' || $action === 'resend') && $email === '') {
        $email = trim((string)($_SESSION['pixr_portal_pending_email'] ?? ''));
    }
    try {
        $result = pixr_id_dispatch($action, [
            'email' => $email,
            'password' => pixr_portal_as_utf8((string)($body['password'] ?? '')),
            'password_confirm' => pixr_portal_as_utf8((string)($body['password_confirm'] ?? '')),
            'code' => preg_replace('/\s+/', '', (string)($body['code'] ?? '')) ?? '',
        ]);
    } catch (Throwable $e) {
        $result = null;
    }
    if (!is_array($result)) {
        markets_out(['ok' => false, 'message' => 'La connexion n’a pas abouti.'], 500);
    }
    if (!empty($result['ok']) && !empty($result['user']) && is_array($result['user'])) {
        pixr_portal_login($result['user']);
        try {
            markets_out(markets_state_payload(pixr_portal_user()));
        } catch (Throwable $e) {
            markets_out(['ok' => false, 'message' => 'Connecté, mais la sélection du compte est illisible.'], 500);
        }
    }
    if (!empty($result['need_code'])) {
        $sent = trim((string)($result['email'] ?? $email));
        $_SESSION['pixr_portal_pending_email'] = $sent;
        markets_out(['ok' => true, 'need_code' => true, 'email' => $sent, 'csrf' => pixr_portal_csrf()]);
    }
    markets_out(['ok' => false, 'message' => pixr_portal_safe_message((string)($result['message'] ?? ''))], 400);
}

if ($action === 'save') {
    if ($user === null) {
        markets_out(['ok' => false, 'message' => 'Connectez-vous pour enregistrer la sélection.'], 401);
    }
    if (!pixr_portal_allow('markets-save', 80, 900)) {
        markets_out(['ok' => false, 'message' => 'Trop d’enregistrements. Réessayez dans un moment.'], 429);
    }
    try {
        markets_write($user, $body);
        markets_out(['ok' => true]);
    } catch (Throwable $e) {
        markets_out(['ok' => false, 'message' => 'La sélection n’a pas pu être enregistrée sur le compte.'], 500);
    }
}

markets_out(['ok' => false, 'message' => 'Action inconnue.'], 400);
