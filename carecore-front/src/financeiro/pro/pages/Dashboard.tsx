import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { DashboardDesktop } from './DashboardDesktop';
import { DashboardMobile } from './DashboardMobile';

export function Dashboard() {
  const isMobile = useIsMobile();

  return isMobile ? <DashboardMobile /> : <DashboardDesktop />;
}