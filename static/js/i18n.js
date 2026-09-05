// Клиентский i18n — теперь только read-only утилита.
// Язык определяется СЕРВЕРОМ (по URL: /, /kk, /en) и приходит в <html lang>.
// JS-переключения нет — все три языка имеют свои URL.
//
// Эта утилита остаётся для динамического контента, который рендерится JS:
//  - карточки договоров (CONTRACT_TYPES.name_ru / name_kz / name_en)
//  - alert-сообщения
//  - placeholder'ы динамически создаваемых полей
//
// `I18n.currentLang` — внутренний код ('ru' | 'kz' | 'en'). 'kk' (URL/HTML)
// маппится на 'kz' (имя JSON-файла), потому что файл исторически называется kz.json.

const I18n = {
    currentLang: (function() {
        const htmlLang = document.documentElement.getAttribute('lang') || 'ru';
        return htmlLang === 'kk' ? 'kz' : htmlLang;
    })(),
    translations: {},

    async init() {
        await this.loadLanguage(this.currentLang);
        this.applyTranslations();
        this.markActiveSwitcher();
        document.documentElement.style.visibility = '';
        document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: this.currentLang } }));
    },

    async loadLanguage(lang) {
        try {
            const resp = await fetch(`/static/i18n/${lang}.json`);
            this.translations = await resp.json();
        } catch (e) {
            console.error('Failed to load language:', lang, e);
        }
    },

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (this.translations[key]) {
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = this.translations[key];
                } else {
                    el.textContent = this.translations[key];
                }
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (this.translations[key]) el.placeholder = this.translations[key];
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (this.translations[key]) el.title = this.translations[key];
        });
    },

    t(key) {
        return this.translations[key] || key;
    },

    markActiveSwitcher() {
        // Сервер уже сам ставит .active через Jinja — это страховка на случай
        // если шаблон не обновился.
        document.querySelectorAll('.lang-option').forEach(el => {
            const url = el.getAttribute('href') || '';
            const isActive = (
                (this.currentLang === 'ru' && !url.startsWith('/kk') && !url.startsWith('/en')) ||
                (this.currentLang === 'kz' && url.startsWith('/kk')) ||
                (this.currentLang === 'en' && url.startsWith('/en'))
            );
            el.classList.toggle('active', isActive);
        });
    },
};

// `const` объявления не попадают на window — экспортируем явно.
window.I18n = I18n;

document.addEventListener('DOMContentLoaded', () => I18n.init());
