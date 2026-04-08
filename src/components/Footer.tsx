import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 py-5 text-xs text-gray-400">
      <span>© {new Date().getFullYear()} Jérémy Maisse</span>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/mentions-legales" className="hover:text-gray-500 transition-colors">
        Mentions légales
      </Link>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/confidentialite" className="hover:text-gray-500 transition-colors">
        Confidentialité
      </Link>
      <span className="hidden sm:inline text-gray-300">·</span>
      <Link to="/legal/cgu" className="hover:text-gray-500 transition-colors">
        CGU
      </Link>
    </footer>
  );
}
