import '@hotwired/turbo';
import Alpine from 'alpinejs';
import { registerPlayer } from './player.js';
import { initHome } from './home.js';
import { initSearch } from './search.js';

registerPlayer(Alpine);
window.Alpine = Alpine;
Alpine.start();

// Pages that need scripting of their own start when Turbo shows them (and on a first load).
const pageScripts = () => {
  initHome();
  initSearch();
};
document.addEventListener('turbo:load', pageScripts);
if (document.readyState !== 'loading') pageScripts();
else document.addEventListener('DOMContentLoaded', pageScripts);
