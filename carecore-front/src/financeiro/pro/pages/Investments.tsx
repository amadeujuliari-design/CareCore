import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { InvestmentsDesktop } from './InvestmentsDesktop';
import { InvestmentsMobile } from './InvestmentsMobile';

export function Investments() {
  const isMobile = useIsMobile();

  return isMobile ? <InvestmentsMobile /> : <InvestmentsDesktop />;
}