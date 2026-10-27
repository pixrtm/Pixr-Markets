<?php
declare(strict_types=1);

require dirname(__DIR__) . '/public/compte.php';

$clean = markets_clean([
    'favorites' => ['BTC', '../secret/secrets.php', 'Y:MC.PA', '', 'Y:7203.T', 'bad id'],
    'found' => [
        ['symbol' => 'mc.pa', 'quoteType' => 'EQUITY', 'shortname' => 'LVMH', 'exchDisp' => 'Paris', 'currency' => 'EUR'],
        ['symbol' => '../X', 'quoteType' => 'EQUITY', 'shortname' => 'X', 'exchDisp' => 'X', 'currency' => 'EUR'],
        ['symbol' => 'BTC-USD', 'quoteType' => 'nope', 'shortname' => 'Bitcoin', 'exchDisp' => 'CCC', 'currency' => 'USD'],
    ],
    'period' => 'drop-table',
    'password' => 'should-not-stick',
]);

if ($clean['favorites'] !== ['BTC', 'Y:MC.PA', 'Y:7203.T']) {
    fwrite(STDERR, "favorites\n");
    exit(1);
}
if ($clean['period'] !== '1Y') {
    fwrite(STDERR, "period\n");
    exit(1);
}
if (count($clean['found']) !== 1 || $clean['found'][0]['symbol'] !== 'MC.PA' || $clean['found'][0]['quoteType'] !== 'EQUITY') {
    fwrite(STDERR, "found\n");
    exit(1);
}
if (isset($clean['password'])) {
    fwrite(STDERR, "password leaked\n");
    exit(1);
}
try {
    markets_user_id(['id' => '../secrets']);
    fwrite(STDERR, "id accepted\n");
    exit(1);
} catch (RuntimeException $e) {
}
if (markets_user_id(['id' => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']) !== 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
    fwrite(STDERR, "id hex\n");
    exit(1);
}
echo "ok\n";
