import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { ServiceInvoicesDesktop } from './ServiceInvoicesDesktop';
import { ServiceInvoicesMobile } from './ServiceInvoicesMobile';

export function ServiceInvoices() {
  const isMobile = useIsMobile();

  return isMobile ? <ServiceInvoicesMobile /> : <ServiceInvoicesDesktop />;
}