const I18n = {
    currentLang: localStorage.getItem('lang') || 'ru',
    translations: {},

    async init() {
        await this.loadLanguage(this.currentLang);
        this.applyTranslations();
        this.updateLangSwitcher();
        document.documentElement.style.visibility = '';
    },

    async loadLanguage(lang) {
        try {
            const resp = await fetch(`/static/i18n/${lang}.json`);
            this.translations = await resp.json();
            this.currentLang = lang;
            localStorage.setItem('lang', lang);
            document.documentElement.setAttribute('lang', lang);
        } catch (e) {
            console.error('Failed to load language:', lang, e);
        }
    },

    async switchLanguage(lang) {
        await this.loadLanguage(lang);
        this.applyTranslations();
        this.updateLangSwitcher();
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
            if (this.translations[key]) {
                el.placeholder = this.translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (this.translations[key]) {
                el.title = this.translations[key];
            }
        });
    },

    t(key) {
        return this.translations[key] || key;
    },

    updateLangSwitcher() {
        document.querySelectorAll('.lang-option').forEach(el => {
            el.classList.toggle('active', el.dataset.lang === this.currentLang);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => I18n.init());
