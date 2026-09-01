import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { WhatsappPageDesktop } from './WhatsappPageDesktop';
import { WhatsappPageMobile } from './WhatsappPageMobile';

export function WhatsappPage() {
  const isMobile = useIsMobile();

  return isMobile ? <WhatsappPageMobile /> : <WhatsappPageDesktop />;
}