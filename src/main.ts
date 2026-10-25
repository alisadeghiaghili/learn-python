/**
 * Entry point: mount the App shell into #app. The engine is synchronous, so
 * there is no async boot — the app is ready as soon as it constructs.
 */

import './style.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app root element missing');

const app = new App(root);

// Expose on window for interactive debugging
(window as unknown as { learnPythonApp: App }).learnPythonApp = app;

// Register offline PWA service worker in supported browser environments
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
