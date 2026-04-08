import React from 'react';
import { useTranslation } from 'react-i18next';
import NavBar from '../NavBar';

export default function MentionsLegales() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: t('legal.mentions.breadcrumb') }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">{t('legal.mentions.title')}</h1>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.editorTitle')}</h2>
            <p>
              {t('legal.mentions.editorIntro')}<br />
              <strong>{t('legal.mentions.editorName')}</strong><br />
              {t('legal.mentions.editorSiret')}<br />
              {t('legal.mentions.editorAddress')}<br />
              {t('legal.mentions.editorEmail')}{' '}
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">
                contact@jeremy-maisse.com
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.directorTitle')}</h2>
            <p>Jérémy Maisse</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.hostingTitle')}</h2>
            <p>
              {t('legal.mentions.hostingIntro')}<br />
              <strong>{t('legal.mentions.hostingName')}</strong><br />
              {t('legal.mentions.hostingAddress')}<br />
              {t('legal.mentions.hostingCity')}<br />
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                vercel.com
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.ipTitle')}</h2>
            <p>{t('legal.mentions.ipBody1')}</p>
            <p>{t('legal.mentions.ipBody2')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.liabilityTitle')}</h2>
            <p>{t('legal.mentions.liabilityBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.mentions.lawTitle')}</h2>
            <p>{t('legal.mentions.lawBody')}</p>
          </section>

          <p className="text-xs text-gray-400">{t('legal.updatedAt')}</p>
        </div>
      </main>
    </div>
  );
}
