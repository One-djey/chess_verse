import React from 'react';
import NavBar from '../NavBar';

export default function PolitiqueConfidentialite() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: 'Politique de confidentialité' }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">Politique de confidentialité</h1>

          <p>
            Jérémy Maisse, éditeur de ChessVerse, attache une importance particulière à la protection
            de votre vie privée. Cette politique décrit les données collectées, leur finalité et vos droits
            conformément au Règlement Général sur la Protection des Données (RGPD – UE 2016/679) et à la
            loi française Informatique et Libertés.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Responsable du traitement</h2>
            <p>
              Jérémy Maisse — 71 rue de Roquebillière, 06300 Nice, France<br />
              Email : <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">contact@jeremy-maisse.com</a>
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Données collectées</h2>
            <p>
              ChessVerse <strong>ne collecte aucune donnée personnelle identifiable</strong> : pas de compte,
              pas d'inscription, pas de nom, pas d'adresse email.
            </p>
            <p>
              Les seules données traitées sont des <strong>statistiques d'usage anonymes</strong> via
              Google Analytics 4 (GA4), intégré par Google Tag Manager :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Type et mode de partie lancée</li>
              <li>Résultat de la partie (victoire, défaite, nulle)</li>
              <li>Durée et nombre de coups d'une partie</li>
              <li>Données techniques agrégées : type d'appareil, navigateur, pays (niveau région/pays uniquement)</li>
            </ul>
            <p>
              Ces données ne permettent pas d'identifier un individu. Aucune donnée n'est croisée avec des
              informations publicitaires ou des profils tiers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Finalité du traitement</h2>
            <p>
              Les statistiques collectées servent uniquement à améliorer l'expérience de jeu :
              comprendre les modes les plus utilisés, détecter d'éventuels problèmes techniques et
              orienter les évolutions futures du service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Base légale</h2>
            <p>
              Le traitement repose sur l'<strong>intérêt légitime</strong> de l'éditeur (amélioration du service),
              les données étant strictement anonymes et non utilisées à des fins publicitaires ou commerciales.
              Le Consent Mode de Google est configuré avec <code className="bg-gray-100 px-1 rounded">analytics_storage: granted</code> et
              tous les signaux publicitaires désactivés (<code className="bg-gray-100 px-1 rounded">ad_storage: denied</code>).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Cookies</h2>
            <p>
              ChessVerse utilise le <strong>stockage local du navigateur</strong> (localStorage) pour mémoriser
              vos préférences de jeu (difficulté de l'IA, orientation du plateau, langue de l'interface).
              Ces données restent dans votre navigateur et ne sont jamais transmises à nos serveurs.
            </p>
            <p>
              Google Analytics 4 peut déposer des cookies techniques à des fins de mesure d'audience anonyme.
              Aucun cookie publicitaire ou de personnalisation n'est utilisé.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Mode multijoueur (P2P)</h2>
            <p>
              En mode multijoueur, la connexion entre joueurs est établie en <strong>pair-à-pair via WebRTC</strong>
              (bibliothèque Trystero). Les données de jeu transitent directement entre les navigateurs des joueurs,
              sans passer par nos serveurs. Aucune partie n'est enregistrée.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Sous-traitants</h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong>Vercel Inc.</strong> (hébergement) — San Francisco, USA — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">politique de confidentialité</a></li>
              <li><strong>Google LLC</strong> (Google Analytics 4 / Tag Manager) — Mountain View, USA — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">politique de confidentialité</a></li>
            </ul>
            <p>
              Ces sous-traitants sont situés hors de l'Union Européenne. Les transferts sont encadrés par les
              Clauses Contractuelles Types de la Commission Européenne.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Conservation des données</h2>
            <p>
              Les données analytiques sont conservées 14 mois dans Google Analytics, conformément aux paramètres
              par défaut de la plateforme. Les préférences stockées en localStorage persistent jusqu'à effacement
              manuel de votre navigateur.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">9. Vos droits</h2>
            <p>
              Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
              accès, rectification, effacement, limitation, portabilité et opposition.
            </p>
            <p>
              Étant donné que ChessVerse ne collecte aucune donnée permettant de vous identifier,
              il n'est pas possible de retrouver et associer des données analytiques à votre personne.
            </p>
            <p>
              Pour toute question relative à la vie privée, contactez :{' '}
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">contact@jeremy-maisse.com</a>
            </p>
            <p>
              Vous pouvez également déposer une réclamation auprès de la{' '}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CNIL</a>{' '}
              (Commission Nationale de l'Informatique et des Libertés).
            </p>
          </section>

          <p className="text-xs text-gray-400">Dernière mise à jour : avril 2026</p>
        </div>
      </main>
    </div>
  );
}
