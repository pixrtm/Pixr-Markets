<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=120');

function fail(int $code, string $message): void {
  http_response_code($code);
  echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
  exit;
}

$products = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
$ranges = ['5d', '1mo', '6mo', '1y', '5y'];
$op = $_GET['op'] ?? '';
$urls = [];

function market_symbol(string $symbol): bool {
  return (bool)preg_match('/^[A-Z0-9^=.\-]{1,32}$/', $symbol) && strpos($symbol, '..') === false && !preg_match('/^[.\-]/', $symbol);
}

if ($op === 'coinbase-product') {
  $product = $_GET['product'] ?? '';
  if (!in_array($product, $products, true)) fail(400, 'Actif non pris en charge.');
  $urls[] = 'https://api.coinbase.com/api/v3/brokerage/market/products/'.$product;
} elseif ($op === 'coinbase-candles') {
  $product = $_GET['product'] ?? '';
  $start = $_GET['start'] ?? '';
  $end = $_GET['end'] ?? '';
  if (!in_array($product, $products, true) || !preg_match('/^\d{9,12}$/', $start) || !preg_match('/^\d{9,12}$/', $end)) fail(400, 'Actif non pris en charge.');
  $span = (int)$end - (int)$start;
  if ($span <= 0 || $span > 400 * 86400) fail(400, 'Période invalide.');
  $urls[] = 'https://api.coinbase.com/api/v3/brokerage/market/products/'.$product.'/candles?granularity=ONE_DAY&limit=350&start='.$start.'&end='.$end;
} elseif ($op === 'yahoo') {
  $symbol = strtoupper($_GET['symbol'] ?? '');
  $range = $_GET['range'] ?? '';
  if (!market_symbol($symbol) || !in_array($range, $ranges, true)) fail(400, 'Actif non pris en charge.');
  $path = rawurlencode($symbol);
  $urls[] = 'https://query2.finance.yahoo.com/v8/finance/chart/'.$path.'?interval=1d&range='.$range.'&includeAdjustedClose=false';
  $urls[] = 'https://query1.finance.yahoo.com/v8/finance/chart/'.$path.'?interval=1d&range='.$range.'&includeAdjustedClose=false';
} elseif ($op === 'search') {
  $q = trim($_GET['q'] ?? '');
  if (!preg_match('/^[\p{L}\p{N} .&\'’+\-]{1,80}$/u', $q)) fail(400, 'Recherche invalide.');
  $query = rawurlencode($q);
  $urls[] = 'https://query2.finance.yahoo.com/v1/finance/search?q='.$query.'&quotesCount=24&newsCount=0&enableFuzzyQuery=false';
  $urls[] = 'https://query1.finance.yahoo.com/v1/finance/search?q='.$query.'&quotesCount=24&newsCount=0&enableFuzzyQuery=false';
} else {
  fail(400, 'Requête inconnue.');
}

$dir = sys_get_temp_dir().'/pixr-markets-cache';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$file = $dir.'/'.hash('sha256', $urls[0]).'.json';
if (is_file($file) && time() - filemtime($file) < 600) {
  readfile($file);
  exit;
}

$body = false;
$code = 502;
foreach ($urls as $url) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; PixrMarkets/1.0)',
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
  ]);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($body !== false && $code >= 200 && $code < 300) break;
  if ($code !== 429 && $code !== 403 && $code !== 500) break;
}

if ($body === false || $code < 200 || $code >= 300) {
  fail($code === 429 ? 429 : 502, $code === 429 ? 'La source limite les requêtes. Réessayez dans une minute.' : 'La source est momentanément indisponible.');
}
@file_put_contents($file, $body);
echo $body;
