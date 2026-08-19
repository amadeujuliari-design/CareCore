import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aplicarConsultaCnpjNoForm,
  aplicarConsultaCnpjNoFornecedor,
  mapearConsultaCnpj,
  textoAvisoConsultaCnpj,
} from './nfpConsultaCnpjUtils.js';

describe('consulta CNPJ para cadastro NFP', () => {
  it('mapeia razao, fantasia e endereco da BrasilAPI', () => {
    const dados = mapearConsultaCnpj({
      razao_social: 'SUPERVAREJAO SAUDE LTDA',
      nome_fantasia: 'SUPERVAREJAO',
      email: 'contato@loja.com',
      ddd_telefone_1: '1130916200',
      descricao_tipo_de_logradouro: 'RUA',
      logradouro: 'SETE DE ABRIL',
      numero: '59',
      bairro: 'CENTRO',
      cep: '01043900',
      municipio: 'SAO PAULO',
      uf: 'sp',
      descricao_situacao_cadastral: 'ATIVA',
      inscricoes_estaduais: [{ inscricao_estadual: '123456789', ativo: true }],
    });

    assert.equal(dados.loja, 'SUPERVAREJAO');
    assert.equal(dados.razao_social, 'SUPERVAREJAO SAUDE LTDA');
    assert.equal(dados.logradouro, 'RUA SETE DE ABRIL');
    assert.equal(dados.uf, 'SP');
    assert.equal(dados.inscricao_estadual, '123456789');
    assert.equal(dados.telefone, '1130916200');
  });

  it('usa razao social quando nao ha nome fantasia', () => {
    const dados = mapearConsultaCnpj({ nome: 'LOJA EXEMPLO LTDA', fantasia: '' });
    assert.equal(dados.loja, 'LOJA EXEMPLO LTDA');
    assert.equal(dados.razao_social, 'LOJA EXEMPLO LTDA');
  });

  it('nao sobrescreve campo ja preenchido na edicao', () => {
    const atualizado = aplicarConsultaCnpjNoForm(
      { loja: 'Nome ja cadastrado', razao_social: '', captador: 'DIEGO' },
      { loja: 'Nome da receita', razao_social: 'RAZAO NOVA' },
      { somenteVazios: true },
    );
    assert.equal(atualizado.loja, 'Nome ja cadastrado');
    assert.equal(atualizado.razao_social, 'RAZAO NOVA');
    assert.equal(atualizado.captador, 'DIEGO');
  });

  it('preenche nome e e-mail da empresa no cadastro de fornecedor', () => {
    const atualizado = aplicarConsultaCnpjNoFornecedor(
      { nome: '', email: 'rep@loja.com', email_empresa: '', contato: 'Maria' },
      {
        loja: 'SUPERVAREJAO',
        razao_social: 'SUPERVAREJAO SAUDE LTDA',
        email: 'contato@loja.com',
        telefone: '1130916200',
        cep: '01043900',
        logradouro: 'RUA SETE DE ABRIL',
        numero: '59',
        bairro: 'CENTRO',
        cidade: 'SAO PAULO',
        uf: 'SP',
      },
    );
    assert.equal(atualizado.nome, 'SUPERVAREJAO SAUDE LTDA');
    assert.equal(atualizado.email_empresa, 'contato@loja.com');
    assert.equal(atualizado.email, 'rep@loja.com');
    assert.equal(atualizado.contato, 'Maria');
    assert.equal(atualizado.logradouro, 'RUA SETE DE ABRIL');
  });

  it('nao sobrescreve nome ja preenchido na edicao do fornecedor', () => {
    const atualizado = aplicarConsultaCnpjNoFornecedor(
      { nome: 'Nome interno', email_empresa: '' },
      { razao_social: 'RAZAO NOVA', loja: 'FANTASIA', email: 'a@b.com' },
      { somenteVazios: true },
    );
    assert.equal(atualizado.nome, 'Nome interno');
    assert.equal(atualizado.email_empresa, 'a@b.com');
  });

  it('avisa para conferir os dados da consulta', () => {
    assert.match(textoAvisoConsultaCnpj('ATIVA'), /Confira os dados encontrados/);
    assert.match(textoAvisoConsultaCnpj('BAIXADA'), /Situação cadastral: BAIXADA/);
  });
});
