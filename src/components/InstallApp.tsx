import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const available = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    const complete = () => {
      prompt.current = null;
      setInstalled(true);
      dialog.current?.close();
    };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", complete);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    const event = prompt.current;
    if (!event) {
      dialog.current?.showModal();
      return;
    }
    prompt.current = null;
    setBusy(true);
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      dialog.current?.showModal();
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;
  return (
    <>
      <button className="install-app" onClick={() => void install()} disabled={busy}>
        <Download size={16} /> Installer Noteo
      </button>
      <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title"
        onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
        <button className="icon-button install-close" aria-label="Fermer" onClick={() => dialog.current?.close()}><X size={18} /></button>
        <h2 id="install-title">Noteo, à portée de main.</h2>
        <p>Retrouvez Noteo dans une fenêtre dédiée, depuis votre écran d’accueil ou votre bureau.</p>
        <p>{ios
          ? "Dans Safari, ouvrez le menu Partager, puis choisissez Sur l’écran d’accueil et Ajouter."
          : "Dans le menu de Chrome ou Edge, choisissez Installer Noteo ou Installer cette page comme application. Sur Safari pour Mac, ouvrez Fichier puis Ajouter au Dock."}</p>
        <p className="muted">L’installation dépend de votre navigateur. Vos notes restent liées à votre compte ; leur synchronisation nécessite une connexion Internet.</p>
        <button className="primary" onClick={() => dialog.current?.close()}>Compris</button>
      </dialog>
    </>
  );
}
