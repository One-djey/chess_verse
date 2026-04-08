import React from 'react';
import NavBar from '../NavBar';

export default function CGU() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavBar breadcrumbs={[{ label: 'Conditions générales d\'utilisation' }]} />

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-xl shadow-md p-8 space-y-8 text-gray-700 text-sm leading-relaxed">

          <h1 className="text-2xl font-bold text-gray-900">Conditions Générales d'Utilisation</h1>

          <p>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
            du service ChessVerse, accessible à l'adresse chessverse.app, édité par Jérémy Maisse,
            auto-entrepreneur (SIRET : 928 825 322 00011).
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Objet et accès au service</h2>
            <p>
              ChessVerse est une application web de jeu d'échecs gratuite, accessible sans inscription ni compte.
              Elle propose des modes de jeu en local contre l'IA et en multijoueur pair-à-pair.
              L'accès au service est libre et sans contrepartie financière.
            </p>
            <p>
              L'éditeur se réserve le droit de modifier, suspendre ou interrompre le service à tout moment
              sans préavis ni indemnité.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Utilisation du service</h2>
            <p>L'utilisateur s'engage à utiliser ChessVerse de manière loyale et conforme aux présentes CGU.</p>
            <p>Sont notamment interdits :</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Toute tentative de contournement, décompilation ou exploitation abusive du service ;</li>
              <li>L'utilisation du service à des fins illicites ou contraires à l'ordre public ;</li>
              <li>Toute action susceptible de perturber le bon fonctionnement du service ou des connexions pair-à-pair ;</li>
              <li>L'utilisation de bots ou programmes automatisés visant à manipuler les parties.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Mode multijoueur</h2>
            <p>
              Le mode multijoueur repose sur une connexion directe entre navigateurs (WebRTC / pair-à-pair).
              L'éditeur n'est pas partie aux échanges entre joueurs et décline toute responsabilité quant au
              comportement des utilisateurs entre eux.
            </p>
            <p>
              Aucune conversation, aucun message et aucune donnée de partie ne transite par les serveurs
              de l'éditeur.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Propriété intellectuelle</h2>
            <p>
              L'ensemble des éléments constitutifs de ChessVerse — code source, design, graphismes, dénomination —
              est la propriété exclusive de Jérémy Maisse, sauf éléments tiers dûment identifiés (Stockfish sous
              licence GPLv3, Trystero sous licence MIT).
            </p>
            <p>
              Toute reproduction, représentation, modification ou exploitation non autorisée de ces éléments est
              interdite et constitue une contrefaçon au sens des articles L. 335-2 et suivants du Code de la
              propriété intellectuelle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Limitation de responsabilité</h2>
            <p>
              ChessVerse est fourni « en l'état » sans aucune garantie d'exactitude, de continuité ou
              d'absence de bugs. L'éditeur ne saurait être tenu responsable :
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Des interruptions ou indisponibilités du service ;</li>
              <li>Des pertes de parties ou de données de jeu ;</li>
              <li>Des problèmes de connexion en mode pair-à-pair liés à l'infrastructure réseau des utilisateurs ;</li>
              <li>De tout dommage indirect lié à l'utilisation du service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Modification des CGU</h2>
            <p>
              L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications
              prennent effet dès leur publication sur le site. L'utilisation continue du service après modification
              vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, et à défaut de résolution
              amiable, les tribunaux compétents du ressort de Nice seront seuls compétents.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU :{' '}
              <a href="mailto:contact@jeremy-maisse.com" className="text-blue-600 hover:underline">contact@jeremy-maisse.com</a>
            </p>
          </section>

          <p className="text-xs text-gray-400">Dernière mise à jour : avril 2026</p>
        </div>
      </main>
    </div>
  );
}
