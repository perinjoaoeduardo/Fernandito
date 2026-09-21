"use client";

// Coordena o fim do IntroLoader com a entrada da Hero, pra ela não rodar
// (e terminar) escondida atrás da cortina do loader.
let introComplete = false;
const listeners = new Set<() => void>();

export function markIntroComplete() {
  if (introComplete) return;
  introComplete = true;
  listeners.forEach((callback) => callback());
  listeners.clear();
}

/** Chama `callback` assim que o intro terminar — imediatamente se já tiver terminado. */
export function onIntroComplete(callback: () => void) {
  if (introComplete) {
    callback();
    return () => {};
  }
  listeners.add(callback);
  return () => listeners.delete(callback);
}
