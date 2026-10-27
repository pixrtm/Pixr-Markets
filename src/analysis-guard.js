const NUMBER = /(?<!\d)[+\-]?\d{1,3}(?:[ '\u00a0\u202f’]\d{3})+(?:[.,]\d+)?|(?<!\d)[+\-]?\d+(?:[.,]\d+)?/g;

export function numbersIn(text) {
  const prepared = String(text).replace(/^\s*\d+[.)]\s+/gm, '');
  return [...prepared.matchAll(NUMBER)].map(match => Number(match[0].replace(/[ '\u00a0\u202f’]/g, '').replace(',', '.'))).filter(Number.isFinite);
}

function closeEnough(value, allowed) {
  // Display rounding is at most half a hundredth. A looser gap would let a nearby but different figure pass.
  return Math.abs(value - allowed) <= 0.0051;
}

// The local model may quote only figures present in the sourced context.
export function isGroundedAnswer(text, assetName = '', allowed = []) {
  const content = (assetName ? String(text).replaceAll(String(assetName), '') : String(text)).trim();
  if (content.length < 40) return false;
  return numbersIn(content).every(value => allowed.some(candidate => Number.isFinite(candidate) && closeEnough(value, candidate)));
}

export const unverifiedAnswer = 'L’analyste a ajouté des chiffres qui ne figurent pas dans les données sourcées. Cette réponse a été écartée. Le dossier chiffré à côté reste calculé par l’application. Reformulez la question, ou lancez une nouvelle analyse approfondie.';
