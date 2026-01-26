/*
 * SPDX-License-Identifier: BSD-3-Clause
 * SPDX-FileCopyrightText: Copyright (c) 2026 OpenBlink.org
 */

const I18n = (function() {
  const STORAGE_KEY = 'openblink_language';
  const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ja-easy'];
  const DEFAULT_LANGUAGE = 'en';

  let translations = {};
  let currentLanguage = DEFAULT_LANGUAGE;
  let initialized = false;

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

      try {
        const response = await fetch('i18n/translations.json');
        if (!response.ok) {
          throw new Error('Failed to load translations: ' + response.status);
        }
        translations = await response.json();
      } catch (error) {
        console.error('Failed to load translations:', error);
        translations = {};
      }

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
        return key;
      }

      if (params) {
        Object.keys(params).forEach(function(paramKey) {
          translation = translation.replace(new RegExp('\\{' + paramKey + '\\}', 'g'), params[paramKey]);
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
        const prefix = this.t('compiler.error.prefix');
        const suffix = this.t('compiler.error.suffix');
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
