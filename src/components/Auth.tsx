import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Eye, EyeOff, Leaf, Check } from "lucide-react";
import { auth } from "../lib/firebase";
import { message } from "../lib/utils";
export function Auth({ onDemo }: { onDemo: () => void }) {
  const location = useLocation(),
    navigate = useNavigate();
  const mode =
    location.pathname === "/signup"
      ? "signup"
      : location.pathname === "/reset-password"
        ? "reset"
        : "login";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSent(true);
      } else if (mode === "signup")
        await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Leaf size={23} />
          </span>
          noteo<span className="brand-dot">.</span>
        </a>
        <div>
          <span className="eyebrow">UN PEU D’ORDRE. BEAUCOUP D’IDÉES.</span>
          <h1>
            Faites de la place
            <br />à ce qui vous
            <br />
            <em>inspire.</em>
          </h1>
          <p>
            Vos pensées, vos projets, vos petites découvertes.
            <br />
            Un espace calme pour garder le fil.
          </p>
          <div className="paper-stack">
            <div className="paper-back" />
            <div className="paper">
              <span className="paper-label">
                <BookOpen size={16} /> MON CARNET D’IDÉES
              </span>
              <h3>
                Tout commence
                <br />
                par une petite note.
              </h3>
              <span className="paper-line" />
              <span className="paper-line short" />
              <div className="paper-check">
                <Check size={15} /> Garder l’essentiel.
              </div>
              <div className="paper-spark">✳</div>
            </div>
          </div>
        </div>
        <small>Un espace pour penser. Un endroit pour retrouver.</small>
      </section>
      <section className="auth-form-area">
        <span className="top-caption">
          VOTRE PROCHAIN CHAPITRE COMMENCE ICI
        </span>
        <div className="auth-form">
          <span className="small-icon">
            <Leaf size={23} />
          </span>
          <h2>
            {mode === "signup"
              ? "Bienvenue chez vous."
              : mode === "reset"
                ? "Retrouvons votre accès."
                : "Heureux de vous retrouver."}
          </h2>
          <p>
            {mode === "signup"
              ? "Créez votre espace personnel en quelques instants."
              : mode === "reset"
                ? "Recevez un lien de réinitialisation par email."
                : "Vos idées vous attendent. Reprenons le fil."}
          </p>
          {mode !== "reset" && (
            <>
              <button
                className="google-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await signInWithPopup(auth, new GoogleAuthProvider());
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <span className="google-g">G</span> Continuer avec Google
              </button>
              <div className="divider">
                <span>ou avec votre email</span>
              </div>
            </>
          )}
          <form onSubmit={submit}>
            <label>
              Adresse email
              <input
                type="email"
                placeholder="vous@exemple.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== "reset" && (
              <>
                <label>
                  Mot de passe
                  <div className="password-wrap">
                    <input
                      type={show ? "text" : "password"}
                      minLength={6}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      placeholder="Votre mot de passe"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="Afficher le mot de passe"
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                {mode === "signup" && (
                  <label>
                    Confirmer le mot de passe
                    <input
                      type={show ? "text" : "password"}
                      minLength={6}
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                )}
                {mode === "login" && (
                  <button
                    className="text-button forgot"
                    type="button"
                    onClick={() => {
                      setError("");
                      navigate("/reset-password");
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </>
            )}
            {error && (
              <div role="alert" className="error-box">
                {error}
              </div>
            )}
            {sent && (
              <div className="success-box">
                Si un compte correspond à cet email, un lien vous sera envoyé.
              </div>
            )}
            <button className="primary auth-submit" disabled={busy}>
              {busy
                ? "Un instant…"
                : mode === "signup"
                  ? "Créer mon espace"
                  : mode === "reset"
                    ? "Envoyer le lien"
                    : "Ouvrir mon espace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setSent(false);
                navigate(mode === "login" ? "/signup" : "/login");
              }}
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </div>
          <div className="demo-entry">
            <button onClick={onDemo}>
              Découvrir Noteo sans compte <ArrowRight size={14} />
            </button>
            <small>Démonstration indépendante · rien n’est sauvegardé</small>
          </div>
        </div>
        <footer>Vos notes restent les vôtres. Toujours.</footer>
      </section>
    </div>
  );
}
