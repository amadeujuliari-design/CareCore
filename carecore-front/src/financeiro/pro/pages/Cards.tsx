import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { CardsDesktop } from './CardsDesktop';
import { CardsMobile } from './CardsMobile';

export const Cards = () => {
  const isMobile = useIsMobile();

  return isMobile ? <CardsMobile /> : <CardsDesktop />;
};