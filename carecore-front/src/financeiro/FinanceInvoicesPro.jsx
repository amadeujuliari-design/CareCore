import FinanceProShell from './FinanceProShell';
import { ServiceInvoices } from './pro/pages/ServiceInvoices';

export default function FinanceInvoicesPro() {
  return (
    <FinanceProShell>
      <ServiceInvoices />
    </FinanceProShell>
  );
}
