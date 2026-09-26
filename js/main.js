/**
 * Entry point: wire DOM to the App shell.
 */

import { App } from './shell/app.js';

const app = new App({
  canvas: document.getElementById('canvas'),
  brief: document.getElementById('brief'),
  terminal: document.getElementById('terminal'),
  input: document.getElementById('input'),
  status: document.getElementById('status'),
  levelList: document.getElementById('level-list'),
  golf: document.getElementById('golf'),
});

const form = document.getElementById('repl');
const input = document.getElementById('input');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value;
  input.value = '';
  app.submit(value);
  input.focus();
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById('btn-sandbox').addEventListener('click', () => {
  app.sandboxBoot();
});

document.getElementById('btn-levels').addEventListener('click', () => {
  app.runMeta('levels');
});

document.getElementById('btn-undo').addEventListener('click', () => {
  app.runMeta('undo');
});

document.getElementById('btn-reset').addEventListener('click', () => {
  app.runMeta('reset');
});

input.focus();

// Permalink bootstrap: ?command=... runs on load (LGB parity).
const params = new URLSearchParams(window.location.search);
const bootCommand = params.get('command');
if (bootCommand) {
  for (const chunk of bootCommand.split(';')) {
    if (chunk.trim()) app.submit(chunk.trim());
  }
}
