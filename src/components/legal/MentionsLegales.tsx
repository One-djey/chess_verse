import React from 'react';
import NavBar from '../NavBar';

export default function MentionsLegales() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: 'Mentions légales' }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">Mentions légales</h1>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Éditeur du site</h2>
            <p>
              ChessVerse est édité par :<br />
              <strong>Jérémy Maisse</strong>, auto-entrepreneur<br />
              SIRET : 928 825 322 00011<br />
              71 rue de Roquebillière, 06300 Nice, France<br />
              Email : <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">contact@jeremy-maisse.com</a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Directeur de la publication</h2>
            <p>Jérémy Maisse</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Hébergement</h2>
            <p>
              Le site est hébergé par :<br />
              <strong>Vercel Inc.</strong><br />
              340 Pine Street, Suite 701<br />
              San Francisco, California 94104, États-Unis<br />
              <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">vercel.com</a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu de ce site (code source, design, textes, graphismes) est la propriété exclusive
              de Jérémy Maisse, sauf éléments tiers explicitement mentionnés. Toute reproduction, distribution ou
              utilisation sans autorisation préalable écrite est interdite.
            </p>
            <p>
              Le moteur d'échecs utilisé est <strong>Stockfish</strong>, distribué sous licence GPLv3.
              La bibliothèque de connectivité pair-à-pair est <strong>Trystero</strong>, sous licence MIT.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Limitation de responsabilité</h2>
            <p>
              ChessVerse est proposé à titre gratuit et sans garantie de disponibilité continue. L'éditeur ne saurait
              être tenu responsable des interruptions de service, bugs ou pertes de données liées à l'utilisation
              du site.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">Droit applicable</h2>
            <p>
              Le présent site est soumis au droit français. Tout litige relatif à son utilisation relève de la
              compétence exclusive des tribunaux de Nice, France.
            </p>
          </section>

          <p className="text-xs text-gray-400">Dernière mise à jour : avril 2026</p>
        </div>
      </main>
    </div>
  );
}
