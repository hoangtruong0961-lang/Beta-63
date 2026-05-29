import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../services/db/indexedDB';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  visualEffects: boolean;
  setVisualEffects: (enabled: boolean) => void;
  interfaceMode: 'auto' | 'pc' | 'mobile';
  setInterfaceMode: (mode: 'auto' | 'pc' | 'mobile') => void;
  desktopSiteMode: boolean;
  setDesktopSiteMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [fontFamily, setFontFamilyState] = useState<string>('Inter');
  const [fontSize, setFontSizeState] = useState<number>(16);
  const [visualEffects, setVisualEffectsState] = useState<boolean>(true);
  const [interfaceMode, setInterfaceModeState] = useState<'auto' | 'pc' | 'mobile'>('auto');
  const [resolvedInterfaceMode, setResolvedInterfaceMode] = useState<'pc' | 'mobile'>('pc');
  const [desktopSiteMode, setDesktopSiteModeState] = useState<boolean>(false);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await dbService.getSettings();
      setThemeState(settings.theme || 'dark');
      setFontFamilyState(settings.systemFont || 'Inter');
      setFontSizeState(settings.fontSize || 16);
      setVisualEffectsState(settings.visualEffects !== undefined ? settings.visualEffects : true);
      setInterfaceModeState(settings.interfaceMode || 'auto');
      setDesktopSiteModeState(settings.desktopSiteMode || false);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--font-system', fontFamily);
    root.style.setProperty('--font-size-base', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  useEffect(() => {
    const updateResolvedMode = () => {
      if (desktopSiteMode) {
        setResolvedInterfaceMode('pc');
        return;
      }
      if (interfaceMode === 'auto') {
        const isMobileDevice = typeof window !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 1024);
        setResolvedInterfaceMode(isMobileDevice ? 'mobile' : 'pc');
      } else {
        setResolvedInterfaceMode(interfaceMode);
      }
    };

    updateResolvedMode();

    if (interfaceMode === 'auto' && !desktopSiteMode) {
      window.addEventListener('resize', updateResolvedMode);
      return () => window.removeEventListener('resize', updateResolvedMode);
    }
  }, [interfaceMode, desktopSiteMode]);

  useEffect(() => {
    const root = document.getElementById('root');
    const docEl = window.document.documentElement;
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    const updateScaling = () => {
      if (desktopSiteMode) {
        docEl.classList.add('desktop-site-mode');
        // Inject desktop mode style overrides!
        const styleId = 'desktop-site-overrides-style';
        let styleEl = document.getElementById(styleId);
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          
          let overrideCss = '';
          try {
            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i];
              try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                
                for (let j = 0; j < rules.length; j++) {
                  const rule = rules[j];
                  if (rule.type === CSSRule.MEDIA_RULE) {
                    const mediaRule = rule as CSSMediaRule;
                    const mediaText = mediaRule.media.mediaText;
                    
                    if (mediaText.includes('min-width')) {
                      const match = mediaText.match(/min-width:\s*(\d+)px/);
                      if (match) {
                        const minWidth = parseInt(match[1], 10);
                        if (minWidth <= 1280) {
                          const subRules = mediaRule.cssRules || mediaRule.rules;
                          for (let k = 0; k < subRules.length; k++) {
                            const subRule = subRules[k];
                            if (subRule.type === CSSRule.STYLE_RULE) {
                              const styleRule = subRule as CSSStyleRule;
                              const selectorText = styleRule.selectorText;
                              const selectors = selectorText.split(',');
                              const prefixedSelectors = selectors.map(sel => {
                                const s = sel.trim();
                                if (s.startsWith('html') || s.startsWith('body')) {
                                  return s.replace(/^(html|body)/, '$1.desktop-site-mode ');
                                }
                                return `.desktop-site-mode ${s}`;
                              });
                              
                              const propertiesText = styleRule.style.cssText;
                              overrideCss += `${prefixedSelectors.join(', ')} { ${propertiesText} }\n`;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                // Ignore cross-origin warnings safely
              }
            }
          } catch (globalError) {
            console.error('Error generating desktop styles:', globalError);
          }
          
          styleEl.textContent = overrideCss;
          document.head.appendChild(styleEl);
        }

        if (viewportMeta) {
          const screenWidth = typeof window !== 'undefined' ? (window.screen.width || window.innerWidth || 390) : 390;
          // Calculate scale to fit 1280px page width into physical screen size
          const computedScale = Math.min(1.0, screenWidth / 1280);
          viewportMeta.setAttribute('content', `width=1280, initial-scale=${computedScale}, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes`);
        }

        // Clean up root HTML element zoom/transform
        docEl.style.zoom = '1.0';
        docEl.style.transform = '';
        docEl.style.transformOrigin = '';
        docEl.style.width = '';
        docEl.style.height = '';
        docEl.style.overflow = '';
        document.body.style.overflow = '';

        if (root) {
          const actualWidth = window.innerWidth;
          const actualHeight = window.innerHeight;
          const targetWidth = 1280;
          const scale = actualWidth / targetWidth;
          const targetHeight = Math.round(actualHeight / scale);

          // Only apply scale/transform as fallback if we are confined in a smaller container (like iframe)
          // wherein window.innerWidth is small despite the viewportMeta.
          if (actualWidth < 1024) {
            root.style.width = `${targetWidth}px`;
            root.style.height = `${targetHeight}px`;
            root.style.transform = `scale(${scale})`;
            root.style.transformOrigin = 'top left';
            root.style.overflow = 'hidden';
            root.style.position = 'absolute';
            root.style.left = '0';
            root.style.top = '0';
          } else {
            root.style.width = '100%';
            root.style.height = '100%';
            root.style.transform = '';
            root.style.transformOrigin = '';
            root.style.overflow = '';
            root.style.position = '';
            root.style.left = '';
            root.style.top = '';
          }
        }
      } else {
        docEl.classList.remove('desktop-site-mode');
        const styleEl = document.getElementById('desktop-site-overrides-style');
        if (styleEl) {
          styleEl.remove();
        }

        if (viewportMeta) {
          viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        docEl.style.overflow = '';
        document.body.style.overflow = '';

        if (root) {
          root.style.width = '100%';
          root.style.height = '100%';
          root.style.transform = '';
          root.style.transformOrigin = '';
          root.style.overflow = '';
          root.style.position = '';
          root.style.left = '';
          root.style.top = '';
        }

        const scale = resolvedInterfaceMode === 'mobile' ? 0.7 : 1.0;
        const isZoomSupported = 'zoom' in docEl.style;

        if (isZoomSupported) {
          docEl.style.zoom = scale.toString();
          docEl.style.transform = '';
          docEl.style.transformOrigin = '';
          docEl.style.width = '';
          docEl.style.height = '';
        } else {
          if (scale === 0.7) {
            docEl.style.transform = 'scale(0.7)';
            docEl.style.transformOrigin = 'top left';
            docEl.style.width = '142.857%';
            docEl.style.height = '142.857%';
          } else {
            docEl.style.transform = '';
            docEl.style.transformOrigin = '';
            docEl.style.width = '';
            docEl.style.height = '';
          }
        }
      }
    };

    updateScaling();
    window.addEventListener('resize', updateScaling);
    return () => {
      window.removeEventListener('resize', updateScaling);
    };
  }, [resolvedInterfaceMode, desktopSiteMode]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setFontFamily = (font: string) => {
    setFontFamilyState(font);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
  };

  const setVisualEffects = (enabled: boolean) => {
    setVisualEffectsState(enabled);
  };

  const setInterfaceMode = (mode: 'auto' | 'pc' | 'mobile') => {
    setInterfaceModeState(mode);
  };

  const setDesktopSiteMode = (enabled: boolean) => {
    setDesktopSiteModeState(enabled);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, toggleTheme, setTheme, 
      fontFamily, setFontFamily, 
      fontSize, setFontSize,
      visualEffects, setVisualEffects,
      interfaceMode, setInterfaceMode,
      desktopSiteMode, setDesktopSiteMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
