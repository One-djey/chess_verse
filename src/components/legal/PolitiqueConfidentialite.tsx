import React from 'react';
import { useTranslation } from 'react-i18next';
import NavBar from '../NavBar';

export default function PolitiqueConfidentialite() {
  const { t } = useTranslation();
  const dataItems = t('legal.privacy.dataItems', { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: t('legal.privacy.breadcrumb') }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">{t('legal.privacy.title')}</h1>

          <p>{t('legal.privacy.intro')}</p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.controllerTitle')}</h2>
            <p>
              Jérémy Maisse — 71 rue de Roquebillière, 06300 Nice, France<br />
              Email :{' '}
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">
                contact@jeremy-maisse.com
              </a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.dataTitle')}</h2>
            <p>{t('legal.privacy.dataBody1')}</p>
            <p>{t('legal.privacy.dataBody2')}</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              {dataItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p>{t('legal.privacy.dataBody3')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.purposeTitle')}</h2>
            <p>{t('legal.privacy.purposeBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.basisTitle')}</h2>
            <p>{t('legal.privacy.basisBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.cookiesTitle')}</h2>
            <p>{t('legal.privacy.cookiesBody1')}</p>
            <p>{t('legal.privacy.cookiesBody2')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.p2pTitle')}</h2>
            <p>{t('legal.privacy.p2pBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.processorsTitle')}</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong>Vercel Inc.</strong> ({t('legal.privacy.processorsHosting')}) — San Francisco, USA —{' '}
                <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {t('legal.privacy.processorsPrivacyLink')}
                </a>
              </li>
              <li>
                <strong>Google LLC</strong> ({t('legal.privacy.processorsAnalytics')}) — Mountain View, USA —{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {t('legal.privacy.processorsPrivacyLink')}
                </a>
              </li>
            </ul>
            <p>{t('legal.privacy.processorsBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.retentionTitle')}</h2>
            <p>{t('legal.privacy.retentionBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.privacy.rightsTitle')}</h2>
            <p>{t('legal.privacy.rightsBody1')}</p>
            <p>{t('legal.privacy.rightsBody2')}</p>
            <p>
              {t('legal.privacy.rightsBody3')}{' '}
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">
                contact@jeremy-maisse.com
              </a>
            </p>
            <p>
              {t('legal.privacy.rightsCnil')}{' '}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                CNIL
              </a>{' '}
              {t('legal.privacy.rightsCnilSuffix')}
            </p>
          </section>

          <p className="text-xs text-gray-400">{t('legal.updatedAt')}</p>
        </div>
      </main>
    </div>
  );
}
