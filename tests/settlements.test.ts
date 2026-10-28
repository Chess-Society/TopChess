import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perSessionShare } from '../src/lib/manual-settlements';
import { money } from '../src/lib/domain';
test('el reparto de cuatro clases conserva cada céntimo y el formato no redondea importes', () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => perSessionShare(2375, i)),
    [594, 594, 594, 593],
  );
  assert.equal(
    [0, 1, 2, 3].reduce((sum, i) => sum + perSessionShare(2375, i), 0),
    2375,
  );
  assert.match(money(594), /5,94/);
});
