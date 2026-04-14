// ═══════════════════════════════════════════════════
// I18N — Internationalization Engine
// ═══════════════════════════════════════════════════
var _currentLang = localStorage.getItem('benam_lang') || 'he';

const TRANSLATIONS = {
  he: {
    prep: 'הכנה',
    aran: 'אר"ן',
    data: 'נתונים',
    start_mission: 'התחל משימה',
    end_mission: 'סיים אר"ן',
    add_cas: 'הוסף פגוע',
    force: 'כוח',
    comms: 'קשר',
    evac: 'פינוי',
    search: 'חיפוש...',
    settings: 'הגדרות',
    night_mode: 'תצוגת לילה',
    fullscreen: 'מסך מלא'
  },
  en: {
    prep: 'Prep',
    aran: 'MCE',
    data: 'Data',
    start_mission: 'Start Mission',
    end_mission: 'End Mission',
    add_cas: 'Add Casualty',
    force: 'Force',
    comms: 'Comms',
    evac: 'Evac',
    search: 'Search...',
    settings: 'Settings',
    night_mode: 'Night Mode',
    fullscreen: 'Fullscreen'
  }
};

function t(key) {
  return TRANSLATIONS[_currentLang][key] || key;
}

function setLanguage(lang) {
  _currentLang = lang;
  localStorage.setItem('benam_lang', lang);
  // Persist state before reload to prevent data loss during active mission
  if (typeof saveState === 'function') saveState();
  setTimeout(() => location.reload(), 200); // allow IDB write to complete
}

function applyTranslations() {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.dataset.t;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t(key);
    else el.textContent = t(key);
  });
  // Update direction
  document.documentElement.dir = _currentLang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = _currentLang;
}

function toggleLanguage() {
  setLanguage(_currentLang === 'he' ? 'en' : 'he');
}

if (typeof window !== 'undefined') {
  window.t = t;
  window.setLanguage = setLanguage;
  window.toggleLanguage = toggleLanguage;
  window.applyTranslations = applyTranslations;
}
// Run on load
setTimeout(applyTranslations, 500);
