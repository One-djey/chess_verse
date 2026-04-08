import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 py-5 text-xs text-gray-400">
      <span>© {new Date().getFullYear()} Jérémy Maisse</span>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/mentions-legales" className="hover:text-gray-500 transition-colors">
        {t('legal.footer.mentions')}
      </Link>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/confidentialite" className="hover:text-gray-500 transition-colors">
        {t('legal.footer.privacy')}
      </Link>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/cgu" className="hover:text-gray-500 transition-colors">
        {t('legal.footer.terms')}
      </Link>
    </footer>
  );
}
