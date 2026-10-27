import {isGroundedAnswer, numbersIn, unverifiedAnswer} from './analysis-guard.js';

export function allowedFigures(context) {
  return numbersIn(JSON.stringify(context ?? {}));
}

function formatNumber(value, digits) {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('fr-CH', {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value);
}

function priceDigits(context) {
  const digits = Number(context?.decimales);
  if (Number.isInteger(digits) && digits >= 0 && digits <= 8) return digits;
  const price = Math.abs(Number(context?.cours?.prix));
  return Number.isFinite(price) && price > 0 && price < 10 ? 4 : 2;
}

function formatPercent(value) {
  const body = formatNumber(value, 2);
  if (!body) return null;
  const numeric = Number(body.replace(/\u2212/g, '-').replace(/[ '\u00a0\u202f’]/g, '').replace(',', '.'));
  if (numeric === 0) return `${body.replace(/^[-\u2212]/, '')} %`;
  if (value > 0 && !body.startsWith('+')) return `+${body} %`;
  return `${body} %`;
}

function move(value) {
  const body = formatNumber(value, 2);
  if (!body) return 'indisponible';
  const numeric = Number(body.replace(/\u2212/g, '-').replace(/[ '\u00a0\u202f’]/g, '').replace(',', '.'));
  if (numeric === 0) return 'stable';
  return numeric < 0 ? 'baisse' : 'hausse';
}

function shownDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('fr-CH', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'});
}

function withCurrency(amount, currency) {
  return `${amount}${currency ? ` ${currency}` : ''}`.replace(/\s+\./, '.');
}

function situation(c) {
  const digits = priceDigits(c);
  const cours = c.cours;
  const parts = [`${c.actif || 'Cet actif'} (${c.symbole || 'symbole non précisé'}) est lu dans le dossier. Source : ${c.source || 'indiquée'}.`];
  if (cours && formatNumber(cours.prix, digits)) {
    parts.push(`Le cours affiché est ${withCurrency(formatNumber(cours.prix, digits), c.devise)}.`);
    const variation = formatPercent(cours.variation_pourcent);
    if (variation) parts.push(`La variation affichée est ${variation}.`);
    const when = shownDate(cours.date);
    if (when) parts.push(`La date affichée est ${when}.`);
  } else {
    parts.push('Le dossier ne contient aucun cours. Aucun prix n’est proposé à la place.');
  }
  if (c.frequence) parts.push(c.frequence.endsWith('.') ? c.frequence : `${c.frequence}.`);
  if (c.description) parts.push(c.description);
  return parts.join(' ');
}

function trajectoire(c) {
  const h = c.historique;
  const digits = priceDigits(c);
  if (!h || !formatPercent(h.performance_pourcent)) return 'La trajectoire chiffrée n’est pas dans le dossier. Le texte ne la remplace pas par une estimation.';
  const sens = move(h.performance_pourcent);
  const parts = [`Du ${shownDate(h.debut)} au ${shownDate(h.fin)}, la performance affichée est ${formatPercent(h.performance_pourcent)}.`];
  if (formatNumber(h.observations, 0)) parts.push(`Cette mesure repose sur ${formatNumber(h.observations, 0)} clôtures, hors frais, dividendes et fiscalité.`);
  if (formatNumber(h.plus_bas, digits) && formatNumber(h.plus_haut, digits)) parts.push(`Le plus bas affiché est ${formatNumber(h.plus_bas, digits)} et le plus haut ${formatNumber(h.plus_haut, digits)}.`);
  if (sens === 'hausse') parts.push('Le dernier point affiché est au-dessus du premier. Cela décrit le passé, pas la suite.');
  else if (sens === 'baisse') parts.push('Le dernier point affiché est en dessous du premier. Cela décrit le passé, pas la suite.');
  else parts.push('À la précision affichée, les deux bouts de la fenêtre se rejoignent. Cela décrit le passé, pas la suite.');
  return parts.join(' ');
}

function risque(c) {
  const h = c.historique;
  if (!h) return 'Le risque passé ne peut pas être chiffré : l’historique n’est pas dans le dossier.';
  const parts = [];
  const vol = formatNumber(h.volatilite_annualisee_pourcent, 2);
  if (vol) parts.push(`La volatilité annualisée affichée est ${vol} %. Elle mesure les à-coups déjà observés, pas ceux à venir.`);
  else parts.push('La volatilité n’a pas pu être calculée avec les observations du dossier.');
  const drop = formatPercent(h.baisse_maximale_pourcent);
  if (drop) parts.push(`La plus forte baisse affichée depuis un sommet est ${drop}.`);
  if (Number.isFinite(h.ecart_max_jours) && h.ecart_max_jours > 4) parts.push(`L’écart le plus long entre deux observations est de ${formatNumber(h.ecart_max_jours, 0)} jours. La série a donc des trous, et la volatilité s’interprète avec plus de prudence.`);
  parts.push('Ces mesures ne constituent ni un plafond de perte ni une garantie.');
  return parts.join(' ');
}

function lecture(c) {
  const h = c.historique;
  const parts = ['La lecture relie uniquement les chiffres déjà affichés. Elle n’ajoute ni objectif, ni probabilité, ni signal d’achat ou de vente.'];
  if (h && formatPercent(h.performance_pourcent) && formatPercent(h.baisse_maximale_pourcent)) parts.push(`La performance de ${formatPercent(h.performance_pourcent)} et la baisse maximale de ${formatPercent(h.baisse_maximale_pourcent)} ne racontent pas la même chose : l’une compare les deux bouts de la fenêtre, l’autre le pire passage depuis un sommet.`);
  else if (!h && !c.cours) parts.push('Sans cours ni historique, elle ne peut pas dire si la valeur a monté ou baissé.');
  parts.push('Rien dans ce dossier ne dit ce que fera le prochain cours.');
  return parts.join(' ');
}

function ombres(c) {
  return `Les zones d’ombre sont celles que le dossier laisse ouvertes. ${c.limites || 'Les résultats d’entreprise, l’actualité et le carnet d’ordres ne sont pas dans les données.'} La source ${c.source || 'indiquée'} peut différer d’un autre fournisseur. En cas de conflit, les chiffres affichés dans le dossier font foi.`;
}

function scenarios(c) {
  const h = c.historique;
  const cours = c.cours;
  const digits = priceDigits(c);
  const parts = ['Les scénarios restent conditionnels. Aucun prix cible et aucune probabilité ne sont proposés.'];
  if (cours && formatNumber(cours.prix, digits)) parts.push(`Si les prochains cours restent proches du cours affiché de ${withCurrency(formatNumber(cours.prix, digits), c.devise)}, la situation actuelle se prolonge. Ce n’est pas une prévision.`);
  const drop = formatPercent(h?.baisse_maximale_pourcent);
  if (drop) parts.push(`Si une nouvelle baisse dépasse la baisse maximale déjà affichée de ${drop}, le risque passé ne suffit plus à décrire ce qui se passe.`);
  parts.push('Une reprise du terrain déjà perdu, ou une poursuite du mouvement déjà vu, est également possible. Le dossier ne dit pas laquelle se produira.');
  return parts.join(' ');
}

function limites() {
  return 'Ce texte n’est pas un conseil en investissement. Il ne dit ni d’acheter ni de vendre. Il peut mal relier des faits exacts, ou oublier un risque. En cas de différence avec le dossier chiffré, ce sont les chiffres du dossier qui font foi, pas ces phrases.';
}

const sections = {
  situation: ['Situation', situation],
  trajectoire: ['Trajectoire', trajectoire],
  risque: ['Risque passé', risque],
  lecture: ['Lecture', lecture],
  ombres: ['Zones d’ombre', ombres],
  scenarios: ['Scénarios', scenarios],
  limites: ['Limites', limites]
};

function intent(question) {
  const q = String(question || '').toLowerCase();
  if (/achet|vend|conseil|objectif|prix cible|probabilit/.test(q)) return 'refuse';
  if (/approfond|analyse/.test(q)) return 'analyse';
  if (/risque/.test(q)) return 'risks';
  if (/sc[eé]nario/.test(q)) return 'scenarios';
  if (/ombre|manque|aveugle/.test(q)) return 'blind';
  if (/r[eé]sum/.test(q)) return 'summary';
  return 'analyse';
}

function compose(question, context) {
  const kind = intent(question);
  const order = {
    refuse: ['situation', 'limites'],
    risks: ['risque', 'ombres', 'limites'],
    scenarios: ['scenarios', 'limites'],
    blind: ['ombres', 'limites'],
    summary: ['situation', 'lecture', 'limites'],
    analyse: ['situation', 'trajectoire', 'risque', 'lecture', 'ombres', 'scenarios', 'limites']
  }[kind];
  const preface = kind === 'refuse' ? 'La demande appelle un conseil ou un objectif. Pixr ne le fournit pas. Voici seulement ce que le dossier permet de dire.\n\n' : '';
  return preface + order.map(key => `${sections[key][0]}.\n${sections[key][1](context)}`).join('\n\n');
}

export function stop() {}
export function unload() {}

export async function generate(question, context, _prior, onChunk) {
  const text = compose(question, context || {});
  const answer = isGroundedAnswer(text, context?.actif, allowedFigures(context)) ? text : unverifiedAnswer;
  onChunk?.(answer);
  return answer;
}
