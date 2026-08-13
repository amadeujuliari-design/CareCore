import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { usuarioPodeGerenciarCadastroAtividades } from './rbacUtils.js';

describe('usuarioPodeGerenciarCadastroAtividades', () => {
  it('fora do SIAT: perfil operacional pode gerenciar cadastro', () => {
    assert.equal(
      usuarioPodeGerenciarCadastroAtividades(
        { perfil_acesso: 'Técnico', email: 'tec@aeb.org.br' },
        { perfilDefaults: 'generico' },
      ),
      true,
    );
  });

  it('SIAT: gestor, Luciana e manutencao podem; tecnico nao', () => {
    assert.equal(
      usuarioPodeGerenciarCadastroAtividades(
        { perfil_acesso: 'Gestor', email: 'gestor@aeb.org.br' },
        { perfilDefaults: 'siat' },
      ),
      true,
    );
    assert.equal(
      usuarioPodeGerenciarCadastroAtividades(
        { perfil_acesso: 'Administrativo', email: 'luciana@carecore.com' },
        { perfilDefaults: 'siat' },
      ),
      true,
    );
    assert.equal(
      usuarioPodeGerenciarCadastroAtividades(
        { perfil_acesso: 'Manutenção', is_manutencao: true, email: 'man@carecore.com' },
        { perfilDefaults: 'siat' },
      ),
      true,
    );
    assert.equal(
      usuarioPodeGerenciarCadastroAtividades(
        { perfil_acesso: 'Técnico', email: 'tec@aeb.org.br' },
        { perfilDefaults: 'siat' },
      ),
      false,
    );
  });
});
