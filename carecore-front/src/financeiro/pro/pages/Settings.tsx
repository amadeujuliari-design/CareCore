import { useIsMobile } from '../hooks/useIsMobile';
// @ts-ignore
import { SettingsDesktop } from './SettingsDesktop';
import { SettingsMobile } from './SettingsMobile';

export function Settings() {
  const isMobile = useIsMobile();

  return isMobile ? <SettingsMobile /> : <SettingsDesktop />;
}