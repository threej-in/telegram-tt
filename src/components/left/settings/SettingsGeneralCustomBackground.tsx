import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useState, useMemo, memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectTheme } from '../../../global/selectors';

import { IThemeSettings, type ThemeKey } from '../../../types';

import useHistoryBack from '../../../hooks/useHistoryBack';
import { useWebGL } from '../../../hooks/useWebGL';

import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';
import Select from '../../ui/Select';
import WebGLBackground, { DEFAULT_GRADIENT, DEFAULT_PATTERN, DEFAULT_PATTERN_SIZE, Pattern } from '../../ui/WebGLBackground';

import './SettingsGeneralCustomBackground.scss';

// Import pattern assets
import { maskImages } from './helpers/patterns';
import { DARK_THEME_PATTERN_COLOR, DEFAULT_PATTERN_COLOR } from '../../../config';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  theme: ThemeKey;
  currentThemeSettings: Partial<Record<ThemeKey, IThemeSettings>>;
}

const SettingsGeneralCustomBackground: FC<OwnProps & StateProps> = ({
  isActive,
  onReset,
  theme,
  currentThemeSettings
}) => {
  const { setThemeSettings } = getActions();
  const customThemeKey = `custom-${theme}` as ThemeKey;
  const isWebGLSupported = useWebGL();

  // Parse stored settings
  const storedSettings = useMemo(() => {
    const { background, backgroundColor, patternColor } = currentThemeSettings[customThemeKey] || {};
    const gradientColors = backgroundColor?.split(":") || [];
    const [maskImage, size] = background?.split(":") || [];

    const gradient = {
      color1: gradientColors[0] || DEFAULT_GRADIENT.color1,
      color2: gradientColors[1] || DEFAULT_GRADIENT.color2,
      color3: gradientColors[2] || DEFAULT_GRADIENT.color3,
      color4: gradientColors[3] || DEFAULT_GRADIENT.color4,
    };

    return {
      gradient,
      maskImage,
      size: Number(size),
      patternColor,
    };
  }, [currentThemeSettings, customThemeKey]);

  const [maskImage, setMaskImage] = useState<string | undefined>(storedSettings.maskImage);
  const [size, setSize] = useState<number | undefined>(storedSettings.size || DEFAULT_PATTERN_SIZE);
  const [patternColor, setPatternColor] = useState<string>(
    storedSettings.patternColor || (theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR)
  );
  const [gradient, setGradient] = useState<typeof DEFAULT_GRADIENT>(storedSettings.gradient);

  const handleColorChange = useCallback((newColor: string, colorKey: keyof typeof DEFAULT_GRADIENT) => {
    setGradient((prevGradient) => ({
      ...prevGradient,
      [colorKey]: newColor,
    }));
  }, []);

  const handleBackgroundChange = useCallback(() => {
    setThemeSettings({
      theme: customThemeKey,
      background: `${maskImage}:${size}`,
      backgroundColor: Object.values(gradient).join(":"),
      patternColor
    });
  }, [maskImage, size, gradient, patternColor, setThemeSettings, customThemeKey]);

  const handleResetToDefault = useCallback(() => {
    setGradient(DEFAULT_GRADIENT);
    setMaskImage(undefined);
    setSize(undefined);
    setPatternColor(theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR);
  }, [theme]);

  useEffect(() => {
    handleBackgroundChange();
  }, [maskImage, size, patternColor, handleBackgroundChange]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const colorEntries = useMemo(() => (
    Object.entries(gradient).map(([key, value]) => ({
      key: key as keyof typeof DEFAULT_GRADIENT,
      value
    }))
  ), [gradient]);
  const patternOptions = useMemo(() => Object.keys(maskImages).map(key => ({
    value: key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })), []);

  return (
    <div className="SettingsGeneralCustomBackground custom-scroll">
      {!isWebGLSupported && (
        <div className="settings-item settings-item-alert">
          Your device does not support WebGL. Custom background settings are not available.
        </div>
      )}
      {isWebGLSupported && <>
        <div className="settings-item background-preview">
          <WebGLBackground pattern={{
            gradient,
            maskImage,
            size,
            patternColor,
          }} />
        </div>

        <div className="custom-background-settings">
          <div className="settings-item">
            <h4>Colors</h4>
            <div className="color-pickers">
              {colorEntries.map(({ key, value }) => (
                <input
                  key={key}
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(e.target.value, key as keyof typeof DEFAULT_GRADIENT)}
                />
              ))}
            </div>
          </div>

          <div className="settings-item">
            <Checkbox
              label="Enable Pattern"
              checked={Boolean(maskImage)}
              onChange={(e) => setMaskImage(e.target.checked ? DEFAULT_PATTERN : undefined)}
            />

            {maskImage && (
              <div className="pattern-settings">
                <Select
                  label="Pattern Style"
                  value={maskImage}
                  onChange={(e) => setMaskImage(e.target.value)}
                >
                  {patternOptions.map(({ value, label }) => (
                    <option key={value} value={value} selected={value === maskImage}>
                      {label}
                    </option>
                  ))}
                </Select>

                <RangeSlider
                  label="Pattern Size"
                  min={200}
                  max={800}
                  value={size || DEFAULT_PATTERN_SIZE}
                  onChange={(value) => setSize(value)}
                />

                <div className="color-picker">
                  <label>Pattern Color</label>
                  <input
                    type="color"
                    value={patternColor}
                    onChange={(e) => setPatternColor(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="settings-item">
            <Button onClick={handleBackgroundChange}>
              Apply Changes
            </Button>
            <Button color="danger" onClick={handleResetToDefault}>
              Reset to Default
            </Button>
          </div>
        </div>
      </>}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const theme = selectTheme(global);
    const themes = global.settings.themes;

    return {
      theme,
      currentThemeSettings: themes,
    };
  }
)(SettingsGeneralCustomBackground));
