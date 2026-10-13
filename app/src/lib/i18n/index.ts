import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCO from './es-CO.json';

// es-CO es el único idioma del MVP; la estructura admite más (AGENTS.md regla 10).
// Uso estándar de i18next (falso positivo de import/no-named-as-default-member).
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { 'es-CO': { translation: esCO } },
  lng: 'es-CO',
  fallbackLng: 'es-CO',
  interpolation: { escapeValue: false },
});

export default i18n;
