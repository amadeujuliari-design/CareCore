import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { AccountsDesktop } from './AccountsDesktop';
import { AccountsMobile } from './AccountsMobile';

export function Accounts() {
  const isMobile = useIsMobile();

  return isMobile ? <AccountsMobile /> : <AccountsDesktop />;
}