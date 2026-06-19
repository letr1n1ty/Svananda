/**
 * ThemeStep.tsx — Step 4: Theme selection
 */

import { useState } from 'react';
import registry from '../../../shared/theme-registry';
import settingsStyles from '../../settings/Settings.module.css';
import { OB_THEMES, themeKey } from '../constants';
import { StepContainer } from '../onboarding-ui';

interface ThemeStepProps {
  goToStep: (index: number) => void;
}

// 「內建樣式」主題：ID 不含 opencode- 前綴的原始主題，以及 auto 選項
// 這些主題的背景由 CSS 定義，無需 registry 的 backgroundColor hex 色塊
const BUILTIN_STYLED_THEMES = new Set<string>([
  ...registry.getThemeIds().filter((id: string) => !id.startsWith('opencode-')),
  'auto',
]);

function getContrastColor(hexColor?: string): string {
  if (!hexColor) return '#1a1a1a';
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#1a1a1a' : '#eeeeee';
}

export function ThemeStep({ goToStep }: ThemeStepProps) {
  const [activeTheme, setActiveTheme] = useState(() =>
    registry.migrateSavedTheme(localStorage.getItem(registry.STORAGE_KEY))
  );

  return (
    <StepContainer>
      <h1 className="onboarding-title">{t('onboarding.theme.title')}</h1>
      <p className="onboarding-subtitle">{t('onboarding.theme.subtitle')}</p>

      <div className={settingsStyles['theme-options']}>
        {OB_THEMES.map(theme => {
          const key = themeKey(theme);
          const isBuiltin = BUILTIN_STYLED_THEMES.has(theme);
          const themeEntry = theme !== 'auto' ? (registry.THEMES as any)[theme] : undefined;
          const hasCustomBg = !isBuiltin && themeEntry;
          const customBg = hasCustomBg ? themeEntry.backgroundColor : undefined;
          const textColor = customBg ? getContrastColor(customBg) : undefined;
          const modeColor = textColor ? (textColor === '#1a1a1a' ? 'rgba(26, 26, 26, 0.65)' : 'rgba(238, 238, 238, 0.65)') : undefined;

          return (
            <button
              key={theme}
              className={`${settingsStyles['theme-card']}${activeTheme === theme ? ' ' + settingsStyles['active'] : ''}`}
              data-theme={theme}
              onClick={() => {
                setActiveTheme(theme);
                setTheme(theme);
              }}
              style={customBg ? { background: customBg } : undefined}
            >
              <div className={settingsStyles['theme-card-name']} style={textColor ? { color: textColor } : undefined}>
                {t(`settings.appearance.${key}`)}
              </div>
              <div className={settingsStyles['theme-card-mode']} style={modeColor ? { color: modeColor } : undefined}>
                {t(`settings.appearance.${key}Mode`)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="onboarding-actions">
        <button className="ob-btn ob-btn-secondary" onClick={() => goToStep(3)}>
          {t('onboarding.theme.back')}
        </button>
        <button className="ob-btn ob-btn-primary" onClick={() => goToStep(5)}>
          {t('onboarding.theme.next')}
        </button>
      </div>
    </StepContainer>
  );
}
