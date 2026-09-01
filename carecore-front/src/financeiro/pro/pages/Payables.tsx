import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { PayablesDesktop } from './PayablesDesktop';
import { PayablesMobile } from './PayablesMobile';

export function Payables() {
  const isMobile = useIsMobile();

  return isMobile ? <PayablesMobile /> : <PayablesDesktop />;
}