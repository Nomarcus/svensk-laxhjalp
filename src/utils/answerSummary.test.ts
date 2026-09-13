import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnswerSections } from './answerSummary';

test('delar ett vanligt svar utan att dubblera sektionerna', () => {
  const input = '## Kort om uppgiften\nAddera talen.\n## Till dig som vuxen\n$2 + 3 = 5$\n## Så säger du till barnet\nLägg två klossar bredvid tre.';
  const result = parseAnswerSections(input);
  assert.equal(result.structured, true);
  assert.equal(result.brief, 'Addera talen.');
  assert.equal(result.solution, '$2 + 3 = 5$');
  assert.equal(result.child, 'Lägg två klossar bredvid tre.');
  assert.equal(result.remaining, null);
});

test('facit identifieras separat i coachläge', () => {
  const input = '## 🎯 Fråga barnet\nVad vet du?\n## 🪜 Om barnet fastnar\nRita tre ringar.\n## Facit (för dig, inte för barnet)\nSvaret är 12.';
  const result = parseAnswerSections(input);
  assert.equal(result.isCoach, true);
  assert.match(result.coach ?? '', /Vad vet du/);
  assert.equal(result.answer, 'Svaret är 12.');
  assert.doesNotMatch([result.remaining, result.coach].filter(Boolean).join('\n'), /Svaret är 12/);
});

test('okänt äldre format lämnas helt orört', () => {
  const input = 'Här är en äldre förklaring.\n2 − 1 = 1';
  const result = parseAnswerSections(input);
  assert.equal(result.structured, false);
  assert.equal(result.remaining, input);
});

test('hanterar serverns fetstilta rubrik och innehåll på samma rad', () => {
  const input = '**Kort om uppgiften:** Räkna skillnaden.\n**Till dig som vuxen:** $8 - 3 = 5$\n**Så säger du till barnet:** Börja på åtta.';
  const result = parseAnswerSections(input);
  assert.equal(result.brief, 'Räkna skillnaden.');
  assert.equal(result.solution, '$8 - 3 = 5$');
  assert.equal(result.child, 'Börja på åtta.');
});
