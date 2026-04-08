import React from 'react';
import { useTranslation } from 'react-i18next';
import NavBar from '../NavBar';

export default function CGU() {
  const { t } = useTranslation();
  const useItems = t('legal.terms.useItems', { returnObjects: true }) as string[];
  const liabilityItems = t('legal.terms.liabilityItems', { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: t('legal.terms.breadcrumb') }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">{t('legal.terms.title')}</h1>

          <p>{t('legal.terms.intro')}</p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.accessTitle')}</h2>
            <p>{t('legal.terms.accessBody1')}</p>
            <p>{t('legal.terms.accessBody2')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.useTitle')}</h2>
            <p>{t('legal.terms.useIntro')}</p>
            <p>{t('legal.terms.useProhibited')}</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              {useItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.p2pTitle')}</h2>
            <p>{t('legal.terms.p2pBody1')}</p>
            <p>{t('legal.terms.p2pBody2')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.ipTitle')}</h2>
            <p>{t('legal.terms.ipBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.liabilityTitle')}</h2>
            <p>{t('legal.terms.liabilityIntro')}</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              {liabilityItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.changesTitle')}</h2>
            <p>{t('legal.terms.changesBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.lawTitle')}</h2>
            <p>{t('legal.terms.lawBody')}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">{t('legal.terms.contactTitle')}</h2>
            <p>
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">
                contact@jeremy-maisse.com
              </a>
            </p>
          </section>

          <p className="text-xs text-gray-400">{t('legal.updatedAt')}</p>
        </div>
      </main>
    </div>
  );
}
