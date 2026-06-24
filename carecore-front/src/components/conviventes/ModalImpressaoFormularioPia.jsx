import { useEffect, useState } from 'react';

import LeitorCarteirinhaModal from '../LeitorCarteirinhaModal';
import {
  consultarAssinaturaFormularioPia,
  registrarAssinaturaFormularioPia,
  registrarReimpressaoFormularioPiaAssinado,
} from '../../services/conviventesProntuarioService';
import { encontrarConviventePorCodigo } from '../../utils/conviventeIdentificacaoUtils';
import {
  inferirMetodoLeituraCarteirinha,
  montarConviventeParaValidacaoCarteirinha,
} from '../../utils/piaAssinaturaDigitalPrint';
import { obterMensagemErro } from '../../utils/usuariosUtils';

export default function ModalImpressaoFormularioPia({
  aberto,
  modo = 'manual',
  conviventeId,
  convivente,
  nomeConvivente = '',
  numeroProntuario = '',
  onFechar,
  onConfirmar,
}) {
  const [etapa, setEtapa] = useState('pergunta_assinar');
  const [assinaturaExistente, setAssinaturaExistente] = useState(null);
  const [leitorAberto, setLeitorAberto] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto) {
      setEtapa('pergunta_assinar');
      setAssinaturaExistente(null);
      setLeitorAberto(false);
      setProcessando(false);
      setErro('');
      return;
    }

    let ativo = true;

    const carregarAssinatura = async () => {
      setProcessando(true);
      setErro('');
      try {
        const resposta = await consultarAssinaturaFormularioPia(conviventeId);
        if (!ativo) return;
        setAssinaturaExistente(resposta?.assinatura || null);
      } catch (error) {
        if (!ativo) return;
        const status = error?.response?.status;
        const detalhe = error?.response?.data?.detail;
        const rotaIndisponivel = status === 404 && detalhe === 'Not Found';
        const backendIndisponivel = status === 503 || status === 500;

        if (rotaIndisponivel || backendIndisponivel) {
          setAssinaturaExistente(null);
          return;
        }

        setErro(obterMensagemErro(error, 'Não foi possível consultar assinaturas anteriores.'));
      } finally {
        if (ativo) setProcessando(false);
      }
    };

    carregarAssinatura();

    return () => {
      ativo = false;
    };
  }, [aberto, conviventeId]);

  if (!aberto) return null;

  const modoRotulo = modo === 'completo' ? 'completo' : 'manual';
  const fecharTudo = () => {
    setLeitorAberto(false);
    onFechar?.();
  };

  const confirmarImpressao = async (assinaturaDigital) => {
    setProcessando(true);
    setErro('');
    try {
      await onConfirmar?.({ modo, assinaturaDigital });
      fecharTudo();
    } catch (error) {
      setErro(obterMensagemErro(error, 'Não foi possível gerar a impressão do formulário.'));
    } finally {
      setProcessando(false);
    }
  };

  const imprimirSemAssinatura = () => confirmarImpressao(null);

  const assinarDigitalmente = () => {
    if (assinaturaExistente) {
      setEtapa('pergunta_reutilizar');
      return;
    }
    setLeitorAberto(true);
    setErro('');
  };

  const imprimirComAssinaturaExistente = async () => {
    if (!assinaturaExistente) {
      setErro('Nenhuma assinatura digital encontrada para este convivente.');
      return;
    }

    setProcessando(true);
    setErro('');
    try {
      await registrarReimpressaoFormularioPiaAssinado(conviventeId, {
        modo_formulario: modo,
      });
      await confirmarImpressao(assinaturaExistente);
    } catch (error) {
      setErro(obterMensagemErro(error, 'Não foi possível registrar a reimpressão assinada.'));
      setProcessando(false);
    }
  };

  const processarCodigoCarteirinha = async (codigoBruto) => {
    const codigo = String(codigoBruto ?? '').trim();
    if (!codigo) return false;

    const conviventeValidacao = montarConviventeParaValidacaoCarteirinha(
      convivente,
      conviventeId,
      numeroProntuario,
    );

    const conviventeEncontrado = encontrarConviventePorCodigo([conviventeValidacao], codigo);
    if (!conviventeEncontrado) {
      setErro('Esta carteirinha pertence a outro convivente. Use a carteirinha do acolhido deste prontuário.');
      return 'erro_tratado';
    }

    setProcessando(true);
    setErro('');
    try {
      const assinatura = await registrarAssinaturaFormularioPia(conviventeId, {
        codigo_lido: codigo,
        metodo_leitura: inferirMetodoLeituraCarteirinha(codigo),
        modo_formulario: modo,
      });
      setLeitorAberto(false);
      await confirmarImpressao(assinatura);
      return true;
    } catch (error) {
      const status = error?.response?.status;
      const detalhe = error?.response?.data?.detail;
      if (status === 404 && detalhe === 'Not Found') {
        setErro(
          'Assinatura digital ainda não disponível neste servidor. Reinicie o backend local ou aguarde o deploy online.',
        );
      } else {
        setErro(obterMensagemErro(error, 'Não foi possível registrar a assinatura digital.'));
      }
      return 'erro_tratado';
    } finally {
      setProcessando(false);
    }
  };

  const tituloEtapa = etapa === 'pergunta_reutilizar'
    ? 'Assinatura digital existente'
    : 'Imprimir formulário PIA';

  const descricaoEtapa = etapa === 'pergunta_reutilizar'
    ? 'Este convivente já possui assinatura digital registrada no sistema. Escolha como prosseguir.'
    : `Formulário em modo ${modoRotulo}. Deseja assinar digitalmente com a carteirinha do convivente?`;

  return (
    <>
      <div className="carecore-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
        <div className="carecore-modal-panel flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-6 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
              Formulário PIA
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">{tituloEtapa}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{descricaoEtapa}</p>
            <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              {nomeConvivente || 'Convivente'}
              {numeroProntuario ? (
                <span className="ml-2 font-semibold text-slate-500">
                  · Prontuário #{numeroProntuario}
                </span>
              ) : null}
            </p>
          </div>

          {erro && (
            <div className="mx-6 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-2">
            {etapa === 'pergunta_reutilizar' && assinaturaExistente && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900">
                <p className="font-black uppercase text-indigo-700">Última assinatura</p>
                <p className="mt-2">
                  Código: <strong>{assinaturaExistente.codigo_lido}</strong>
                </p>
                {assinaturaExistente.assinado_em && (
                  <p className="mt-1">
                    Em: {new Date(assinaturaExistente.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-2 border-t border-slate-100 p-6 pt-4">
            {etapa === 'pergunta_assinar' ? (
              <>
                <button
                  type="button"
                  onClick={assinarDigitalmente}
                  disabled={processando}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processando ? 'Consultando…' : 'Sim, assinar digitalmente'}
                </button>
                <button
                  type="button"
                  onClick={imprimirSemAssinatura}
                  disabled={processando}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Não, imprimir sem assinatura
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={imprimirComAssinaturaExistente}
                  disabled={processando}
                  className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processando ? 'Registrando…' : 'Imprimir documento já assinado'}
                </button>
                <button
                  type="button"
                  onClick={() => setLeitorAberto(true)}
                  disabled={processando}
                  className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Assinar novamente
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa('pergunta_assinar')}
                  disabled={processando}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Voltar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={fecharTudo}
              disabled={processando}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      <LeitorCarteirinhaModal
        aberto={leitorAberto}
        titulo="Assinar formulário PIA"
        subtitulo="Leia o QR Code ou código de barras da carteirinha deste convivente."
        placeholder="Prontuário, CPF, QR Code ou código de barras"
        erroExterno={leitorAberto ? erro : ''}
        onCodigoLido={processarCodigoCarteirinha}
        onClose={() => {
          setLeitorAberto(false);
          setErro('');
        }}
      />
    </>
  );
}
