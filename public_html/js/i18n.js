/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

// Global translation helper function for use across all modules
function t(key, params) {
  if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') {
    return I18n.t(key, params);
  }
  return null;
}

const I18n = (function() {
  const STORAGE_KEY = 'openblink_language';
  const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ja-easy'];
  const DEFAULT_LANGUAGE = 'en';
  const FETCH_TIMEOUT = 15000;
  const MAX_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 1000;

  let translations = {};
  let translationsCache = null;
  let currentLanguage = DEFAULT_LANGUAGE;
  let initialized = false;

  async function fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

    async function fetchTranslationsWithRetry() {
      if (translationsCache) {
        return translationsCache;
      }
    
      let lastError = null;
    
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const response = await fetchWithTimeout('i18n/translations.json', FETCH_TIMEOUT);
          if (!response.ok) {
            throw new Error('Failed to load translations: ' + response.status);
          }
          const result = await response.json();
          translationsCache = result;
          return result;
        } catch (error) {
          lastError = error;
          console.warn(`Translation fetch attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error.message);
        
          if (attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    
      console.error('Failed to load translations after all retries:', lastError);
      return {};
    }

  function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage || '';
    
    if (browserLang.startsWith('ja')) {
      return 'ja';
    }
    if (browserLang === 'zh-TW' || browserLang === 'zh-Hant') {
      return 'zh-TW';
    }
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    }
    
    return DEFAULT_LANGUAGE;
  }

  function loadSavedLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to load saved language:', e);
    }
    return null;
  }

  function saveLanguage(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language:', e);
    }
  }

  function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(function(element) {
      const key = element.getAttribute('data-i18n');
      const translation = getTranslation(key);
      if (translation) {
        element.textContent = translation;
      }
    });

    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(function(element) {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = getTranslation(key);
      if (translation) {
        element.placeholder = translation;
      }
    });

    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(function(element) {
      const key = element.getAttribute('data-i18n-title');
      const translation = getTranslation(key);
      if (translation) {
        element.title = translation;
      }
    });

    document.documentElement.lang = currentLanguage.split('-')[0];
  }

  function getTranslation(key) {
    const langData = translations[currentLanguage];
    if (langData && langData[key]) {
      return langData[key];
    }
    
    const fallbackData = translations[DEFAULT_LANGUAGE];
    if (fallbackData && fallbackData[key]) {
      return fallbackData[key];
    }
    
    return null;
  }

  function updateLanguageSelector() {
    const selector = document.getElementById('language-selector');
    if (selector) {
      selector.value = currentLanguage;
    }
  }

  return {
        init: async function() {
          if (initialized) return;

          translations = await fetchTranslationsWithRetry();

          const savedLang = loadSavedLanguage();
      if (savedLang) {
        currentLanguage = savedLang;
      } else {
        currentLanguage = detectBrowserLanguage();
      }

      applyTranslations();
      updateLanguageSelector();
      initialized = true;
    },

    setLanguage: function(lang) {
      if (!SUPPORTED_LANGUAGES.includes(lang)) {
        console.warn('Unsupported language:', lang);
        return false;
      }

      currentLanguage = lang;
      saveLanguage(lang);
      applyTranslations();
      updateLanguageSelector();

      const event = new CustomEvent('languageChanged', { detail: { language: lang } });
      document.dispatchEvent(event);

      return true;
    },

    getLanguage: function() {
      return currentLanguage;
    },

    getSupportedLanguages: function() {
      return SUPPORTED_LANGUAGES.slice();
    },

    t: function(key, params) {
      let translation = getTranslation(key);
      if (!translation) {
        return null;
      }

      if (params) {
        Object.keys(params).forEach(function(paramKey) {
          translation = translation.replace(
            new RegExp('\\{' + paramKey + '\\}', 'g'),
            function() { return String(params[paramKey]); }
          );
        });
      }

      return translation;
    },

    isEasyJapanese: function() {
      return currentLanguage === 'ja-easy';
    },

    getLocalizedFileSuffix: function() {
      const suffixes = {
        'en': '.md',
        'zh-CN': '.zh-CN.md',
        'zh-TW': '.zh-TW.md',
        'ja': '.ja.md',
        'ja-easy': '.ja-easy.md'
      };
      return suffixes[currentLanguage] || '.md';
    },

    wrapCompilerError: function(errorMessage) {
      if (this.isEasyJapanese()) {
        const prefix = this.t('compiler.error.prefix') || '';
        const suffix = this.t('compiler.error.suffix') || '';
        return prefix + '\n' + errorMessage + '\n' + suffix;
      }
      return errorMessage;
    },

    getLanguageDisplayName: function(langCode) {
      const names = {
        'en': 'English',
        'zh-CN': '简体中文',
        'zh-TW': '繁體中文',
        'ja': '日本語',
        'ja-easy': 'やさしい日本語'
      };
      return names[langCode] || langCode;
    }
  };
})();
