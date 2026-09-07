import { useEffect, useState } from "react";

// Estado compartido entre la card del home y el ícono del navbar, que viven en
// ramas distintas del árbol: localStorage guarda el día en que se cerró y un evento
// propio avisa el cambio en el momento (el evento `storage` solo llega a otras pestañas).
const KEY = "daily_verse_dismissed";
const EVENT = "daily-verse-dismiss-changed";

const today = () => new Date().toLocaleDateString("en-CA");

const leer = () => {
  try {
    return localStorage.getItem(KEY) === today();
  } catch {
    return false;
  }
};

export function dismissDailyVerse() {
  try {
    localStorage.setItem(KEY, today());
  } catch {
    // Sin localStorage (modo privado) el cierre dura solo esta sesión.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function restoreDailyVerse() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sin localStorage no hay nada guardado que borrar.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDailyVerseDismissed(): boolean {
  const [dismissed, setDismissed] = useState(leer);

  useEffect(() => {
    const onChange = () => setDismissed(leer());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  return dismissed;
}
