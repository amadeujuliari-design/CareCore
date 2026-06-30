import CarteirinhaCard from '../CarteirinhaCard';
import { imprimirCarteirinhaUnitaria } from '../../utils/carteirinhaPrint';

export default function ModalCarteirinha({
  carteirinhaAberta,
  setCarteirinhaAberta,
  quartos,
  listaTecnicos,
  fotoCarteirinha,
  identidadeRelatorio,
  onImpresso = null,
}) {
  if (!carteirinhaAberta) return null;

  return (
    <div className="carecore-modal-overlay fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:bg-white print:p-0">
      <div className="carecore-modal-panel bg-white rounded-2xl shadow-2xl flex flex-col max-w-sm w-full overflow-hidden print:shadow-none print:max-w-none">
        <CarteirinhaCard
          domId="area-cracha"
          convivente={carteirinhaAberta}
          quartos={quartos}
          tecnicos={listaTecnicos}
          fotoCaminho={fotoCarteirinha}
          identidadeRelatorio={identidadeRelatorio}
        />

        <div className="p-4 bg-gray-100 flex justify-between gap-3 print:hidden border-t">
          <button
            onClick={() => setCarteirinhaAberta(null)}
            className="px-4 py-2 bg-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-400 transition-colors w-full text-sm"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => imprimirCarteirinhaUnitaria({
              convivente: carteirinhaAberta,
              quartos,
              tecnicos: listaTecnicos,
              fotoCaminho: fotoCarteirinha,
              identidadeRelatorio,
              onImpresso: (resultado) => {
                onImpresso?.(carteirinhaAberta.id, resultado);
              },
            })}
            className="px-4 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brandDark transition-colors w-full flex justify-center items-center gap-2 shadow-md text-sm"
          >
            Imprimir RG
          </button>
        </div>
      </div>
    </div>
  );
}
