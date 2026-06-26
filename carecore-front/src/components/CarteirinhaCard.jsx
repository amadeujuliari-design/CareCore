import AuthenticatedImage from './AuthenticatedImage';
import logoCarecore from '../assets/logo.PNG';

// Bibliotecas brutas
import QRCodeLib from 'react-qr-code';
import BarcodeLib from 'react-barcode';
import { obterCodigoCarteirinhaConvivente } from '../utils/rotinaDiariaUtils';
import { avaliarCarteirinhaConvivente } from '../utils/carteirinhaValidadeUtils';

// Blindagem: aceita funções e objetos React (como forwardRef do QRCode)
const getValidComponent = (Lib) => {
  if (!Lib) return () => <div className="text-red-500 text-xs">Erro</div>;
  if (typeof Lib === 'function') return Lib;
  if (typeof Lib === 'object' && Lib.$$typeof) return Lib;
  if (Lib.default) return getValidComponent(Lib.default);
  return () => <div className="text-red-500 text-xs">Erro</div>;
};

const QRCode = getValidComponent(QRCodeLib);
const Barcode = getValidComponent(BarcodeLib);

/**
 * Carteirinha de identificação institucional padrão (70mm x 100mm).
 * Reaproveitada no cadastro (impressão unitária) e na central de
 * relatórios (impressão em lote). Para escalar, envolva em um wrapper
 * com transform: scale(...).
 */
export default function CarteirinhaCard({
  convivente,
  quartos = [],
  tecnicos = [],
  fotoCaminho = null,
  identidadeRelatorio = null,
  domId,
}) {
  if (!convivente) return null;

  let nomeAcomodacao = 'Sem Cama (Centro Dia)';
  let tipoAcomodacao = '-';

  if (convivente.leito_id) {
    for (const q of quartos) {
      const leito = q.leitos?.find((l) => l.id === convivente.leito_id);

      if (leito) {
        nomeAcomodacao = `${q.nome} - ${leito.identificacao}`;
        tipoAcomodacao = q.modalidade === 'Transitorio' ? 'Transitório' : 'Fixo';
        break;
      }
    }
  }

  const codigoBarrasValor = obterCodigoCarteirinhaConvivente(convivente);

  const dataEntradaFormatada = convivente.data_entrada
    ? new Date(convivente.data_entrada).toLocaleDateString('pt-BR')
    : 'Não informada';

  const acomodacaoEhTransitoria = tipoAcomodacao === 'Transitório';
  const carteirinhaStatus = avaliarCarteirinhaConvivente(convivente, quartos);
  const cabecalhoClasse = carteirinhaStatus.provisoria
    ? 'bg-orange-600'
    : (carteirinhaStatus.preferencial ? 'bg-amber-500' : 'bg-brand');
  const foto = fotoCaminho ?? convivente.foto_url ?? null;
  const logoProjeto = identidadeRelatorio?.relatorio_logo_url || null;
  const nomeProjeto = identidadeRelatorio?.relatorio_nome_exibicao || 'Projeto';

  const tecnicoResponsavel = tecnicos.find(
    (tec) => tec.id === convivente.tecnico_id
  );

  return (
    <div
      id={domId}
      className="bg-white relative overflow-hidden print:border-none border-2 border-gray-200 mx-auto"
      style={{ width: '70mm', height: '100mm' }}
    >
      <div className={`${cabecalhoClasse} text-white px-1.5 py-1`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-[10.5mm] flex-1 items-center justify-center rounded bg-white/95 px-1">
            {logoProjeto ? (
              <AuthenticatedImage
                caminhoOuUrl={logoProjeto}
                alt={nomeProjeto}
                className="max-h-[9mm] max-w-full object-contain"
              />
            ) : (
              <span className="truncate text-[8px] font-black uppercase tracking-wide text-brand">
                {nomeProjeto}
              </span>
            )}
          </div>

          <div className="flex h-[10.5mm] flex-1 items-center justify-center rounded bg-white/95 px-1">
            <img
              src={logoCarecore}
              alt="CareCore+"
              className="max-h-[9mm] max-w-full object-contain"
            />
          </div>
        </div>
        <p className="mt-0.5 text-center text-[5px] font-medium uppercase tracking-widest opacity-90">
          Identidade Institucional
        </p>
      </div>

      <div className="p-2.5 flex flex-col h-[calc(100mm-32px)]">

        <div className="flex justify-between items-start gap-2 mb-1.5">
          <div className="w-[22mm] h-[28mm] bg-gray-100 border border-gray-300 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
            {foto ? (
              <AuthenticatedImage
                caminhoOuUrl={foto}
                alt="Foto"
                data-carteirinha-foto="true"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl opacity-20">○</span>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-200 rounded p-1">
            <QRCode value={String(convivente.id || '')} size={64} level="M" />
            <span className="text-[6px] text-gray-400 font-mono mt-1">
              Escanear ID
            </span>
          </div>
        </div>

        <div className="space-y-1 mb-1.5">
          <h3 className="font-black text-[11.5px] text-gray-900 uppercase leading-tight line-clamp-2">
            {convivente.nome_social || convivente.nome_completo}
          </h3>
          {carteirinhaStatus.provisoria && (
            <p className="text-[8px] font-black tracking-[0.14em] text-orange-700 uppercase">Provisória</p>
          )}
          {carteirinhaStatus.preferencial && (
            <p className="text-[8px] font-black tracking-[0.14em] text-amber-700 uppercase">Preferencial</p>
          )}

          <div className="grid grid-cols-2 gap-1 text-[8px] text-gray-700 font-mono bg-gray-50 p-1.5 rounded border border-gray-100">
            <p>
              <span className="font-bold text-gray-500">PRONT:</span>{' '}
              #{convivente.numero_institucional || 'S/N'}
            </p>

            <p>
              <span className="font-bold text-gray-500">SISA:</span>{' '}
              {convivente.numero_sisa || 'S/N'}
            </p>

            <p className="col-span-2">
              <span className="font-bold text-gray-500">CPF:</span>{' '}
              {convivente.cpf || 'Não inf.'}
            </p>

            <p className="col-span-2">
              <span className="font-bold text-gray-500">ENTRADA:</span>{' '}
              {dataEntradaFormatada}
            </p>

            <p className="col-span-2 truncate">
              <span className="font-bold text-gray-500">TÉCNICO:</span>{' '}
              {tecnicoResponsavel?.nome || 'Não vinculado'}
            </p>
          </div>
        </div>

        <div
          className={`
            p-1.5 rounded text-[7.5px] mb-2 border
            ${
              carteirinhaStatus.provisoria
                ? 'bg-orange-50 border-orange-200'
                : carteirinhaStatus.preferencial
                  ? 'bg-amber-50 border-amber-200'
                  : acomodacaoEhTransitoria
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50/50 border-blue-100'
            }
          `}
        >
          <p
            className={`
              font-bold uppercase mb-0.5
              ${
                carteirinhaStatus.provisoria
                  ? 'text-orange-700'
                  : carteirinhaStatus.preferencial
                    ? 'text-amber-700'
                    : acomodacaoEhTransitoria
                      ? 'text-amber-700'
                      : 'text-brand'
              }
            `}
          >
            Acomodação Atual
          </p>

          <p className="text-gray-800 font-semibold truncate text-[8.5px]">
            {nomeAcomodacao}
          </p>

          <p
            className={`
              font-bold uppercase mt-0.5
              ${
                carteirinhaStatus.provisoria
                  ? 'text-orange-700'
                  : carteirinhaStatus.preferencial
                    ? 'text-amber-700'
                    : acomodacaoEhTransitoria
                      ? 'text-amber-700'
                      : 'text-blue-600'
              }
            `}
          >
            Tipo: {tipoAcomodacao}
          </p>
        </div>

        <div className="mt-auto w-full bg-white pt-1">
          <div className="text-center mb-1">
            <p className="text-[6px] uppercase tracking-widest text-gray-400 font-bold">
              Identificação de Acesso
            </p>
          </div>

          <div className="flex justify-center overflow-visible px-2" style={{ lineHeight: 0 }}>
            <Barcode
              value={codigoBarrasValor}
              width={1.35}
              height={32}
              margin={8}
              displayValue={false}
              background="transparent"
            />
          </div>

          <div className="text-center mt-0.5">
            <p className="text-[7px] tracking-[2px] font-mono text-gray-700 leading-none">
              {codigoBarrasValor}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
