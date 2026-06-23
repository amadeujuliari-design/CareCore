import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { versaoRemotaDiferente } from './atualizacaoAppUtils.js';

describe('atualizacaoAppUtils', () => {
  it('detecta versao remota diferente da local', () => {
    assert.equal(versaoRemotaDiferente('1.3.2', '1.3.3'), true);
    assert.equal(versaoRemotaDiferente('1.3.3', '1.3.3'), false);
    assert.equal(versaoRemotaDiferente('', '1.3.3'), false);
    assert.equal(versaoRemotaDiferente('1.3.3', ''), false);
  });
});
