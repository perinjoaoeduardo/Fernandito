"use client";

// Coordena o fim do IntroLoader com a entrada da Hero, pra ela não rodar
// (e terminar) escondida atrás da cortina do loader.
// A entrada da Hero só roda quando a cortina do intro terminou E o portão de
// idade já foi confirmado — senão ela acontece escondida atrás do portão.
let introComplete = false;
let introFinished = false;
let ageConfirmed = false;
const listeners = new Set<() => void>();

function flush() {
  if (introComplete || !introFinished || !ageConfirmed) return;
  introComplete = true;
  listeners.forEach((callback) => callback());
  listeners.clear();
}

export function markIntroComplete() {
  introFinished = true;
  // O portão de idade só aparece depois do intro (ver globals.css).
  document.documentElement.dataset.intro = "done";
  ageConfirmed = ageConfirmed || document.documentElement.dataset.age !== "ask";
  flush();
}

/** A cortina do cavalo começou a subir: o portão de idade já aparece por
 * baixo dela, subindo junto (ver globals.css, `data-intro="reveal"`). */
export function markIntroReveal() {
  if (document.documentElement.dataset.intro !== "done")
    document.documentElement.dataset.intro = "reveal";
}

/** O visitante confirmou a idade no portão. */
export function markAgeConfirmed() {
  ageConfirmed = true;
  flush();
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
