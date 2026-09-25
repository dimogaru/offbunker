import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  Cloud,
  FileText,
  FolderOpen,
  HardDrive,
  KeyRound,
  LockKeyhole,
  Luggage,
  MapPinned,
  Plane,
  Shield,
  ShieldCheck,
  Smartphone,
  WifiOff,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import "./login-landing.css";

export default function LoginPage() {
  const { login } = useAuth();
  const isOnline = useOnlineStatus();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "OffBunker — Tu Búnker Digital de Viajes y Documentación Segura";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content =
        "Organiza itinerarios, equipaje y documentos de viaje en OffBunker. Consulta la información disponible en tu dispositivo incluso sin conexión.";
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      if (user.role === "superadmin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast({
        title: isOnline ? "Error de inicio de sesión" : "Error de acceso offline",
        description:
          err instanceof Error ? err.message : "Credenciales incorrectas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ob-landing">
      <header className="ob-header">
        <div className="ob-container ob-header-inner">
          <a className="ob-logo" href="#inicio" aria-label="OffBunker, ir al inicio">
            <span className="ob-logo-mark"><Shield size={20} strokeWidth={2.2} aria-hidden="true" /></span>
            <span>OffBunker</span>
          </a>
          <nav className="ob-nav" aria-label="Navegación principal">
            <a href="#funciones">Cómo funciona</a>
            <a href="#privacidad">Privacidad</a>
            <a href="#planes">Planes</a>
            <a className="ob-nav-cta" href="#acceso">Acceder <ArrowUpRight size={14} aria-hidden="true" /></a>
          </nav>
        </div>
      </header>

      <main id="inicio">
        <section className="ob-hero" aria-labelledby="ob-main-title">
          <div className="ob-container ob-hero-grid">
            <div className="ob-hero-copy">
              <span className="ob-mono ob-hero-eyebrow">Tu viaje, con un lugar propio</span>
              <h1 id="ob-main-title">OffBunker — Tu Búnker Digital de Viajes y Documentación Segura</h1>
              <p className="ob-lead">
                Reservas, rutas y documentos, sin tener que buscarlos entre correos.
                Organiza lo importante antes de salir y consulta lo que ya está disponible
                en tu dispositivo cuando la conexión falle.
              </p>
              <div className="ob-hero-actions">
                <a className="ob-primary-link" href="#acceso">
                  Entrar a mi espacio <ArrowRight size={17} aria-hidden="true" />
                </a>
                <a className="ob-text-link" href="#funciones">
                  Descubrir OffBunker <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
              <div className="ob-hero-footnote">
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Un lugar claro para preparar el viaje. Consulta sin red la información que ya se haya guardado en este dispositivo.</span>
              </div>
            </div>

            <div className="ob-login-stage" id="acceso">
              <div className="ob-login-card">
                <div className="ob-login-card-head">
                  <span className="ob-mono">Acceso a tu espacio</span>
                  <span className="ob-card-status ob-mono">{isOnline ? "En línea" : "Sin conexión"}</span>
                </div>
                <div className="ob-login-body">
                  <span className="ob-login-symbol"><LockKeyhole size={21} strokeWidth={1.8} aria-hidden="true" /></span>
                  <h2>Bienvenido de nuevo.</h2>
                  <p className="ob-login-description">
                    {isOnline
                      ? "Introduce tus credenciales para continuar"
                      : "Verificación local — solo el último usuario registrado puede acceder"}
                  </p>

                  {!isOnline && (
                    <div className="ob-offline-notice" role="status">
                      <WifiOff size={17} aria-hidden="true" />
                      <div>
                        <strong>Sin conexión</strong>
                        <p>Puedes acceder con el último usuario y contraseña que usaste en esta sesión.</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="ob-login-form">
                    <div className="ob-form-field">
                      <Label htmlFor="username">Usuario</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="nombre de usuario"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="ob-form-field">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="ob-login-submit w-full gap-2" disabled={loading}>
                      {loading ? (
                        "Iniciando sesión…"
                      ) : (
                        <>
                          <LogIn size={17} aria-hidden="true" />
                          {isOnline ? "Iniciar sesión" : "Acceder sin conexión"}
                        </>
                      )}
                    </Button>
                  </form>
                </div>
                <div className="ob-login-card-foot">
                  <KeyRound size={14} aria-hidden="true" />
                  <span>Acceso con tu cuenta existente de OffBunker.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ob-trust-strip" aria-label="Aspectos destacados">
          <div className="ob-container ob-trust-inner">
            <div className="ob-trust-item"><WifiOff size={21} aria-hidden="true" /><span>Consulta sin conexión</span></div>
            <div className="ob-trust-item"><FolderOpen size={21} aria-hidden="true" /><span>Todo el viaje, ordenado</span></div>
            <div className="ob-trust-item"><Smartphone size={21} aria-hidden="true" /><span>Documentos personales en tu dispositivo</span></div>
          </div>
        </div>

        <section className="ob-features ob-container" id="funciones" aria-labelledby="ob-features-title">
          <div className="ob-section-intro">
            <div>
              <span className="ob-section-tag ob-mono">01 / Lo que ya puedes hacer</span>
              <h2 className="ob-display ob-section-title" id="ob-features-title">Menos pestañas abiertas.<br />Más viaje por delante.</h2>
            </div>
            <p className="ob-body">Cada dato en su sitio, para que puedas encontrarlo justo cuando importa.</p>
          </div>
          <div className="ob-feature-grid">
            <article className="ob-feature">
              <span className="ob-feature-icon"><MapPinned size={22} aria-hidden="true" /></span>
              <span className="ob-feature-number ob-mono">01</span>
              <div className="ob-feature-content">
                <h3>Itinerarios a la vista</h3>
                <p>Reúne las etapas y la información de tus viajes en un recorrido fácil de consultar.</p>
              </div>
            </article>
            <article className="ob-feature">
              <span className="ob-feature-icon"><FileText size={22} aria-hidden="true" /></span>
              <span className="ob-feature-number ob-mono">02</span>
              <div className="ob-feature-content">
                <h3>Documentos organizados</h3>
                <p>Ten tus reservas y archivos asociados al viaje, sin depender de una bandeja de entrada.</p>
              </div>
            </article>
            <article className="ob-feature">
              <span className="ob-feature-icon"><Luggage size={22} aria-hidden="true" /></span>
              <span className="ob-feature-number ob-mono">03</span>
              <div className="ob-feature-content">
                <h3>Equipaje bajo control</h3>
                <p>Prepara tus listas y sigue lo que llevas antes de cerrar la maleta.</p>
              </div>
            </article>
            <article className="ob-feature">
              <span className="ob-feature-icon"><WifiOff size={22} aria-hidden="true" /></span>
              <span className="ob-feature-number ob-mono">04</span>
              <div className="ob-feature-content">
                <h3>Una referencia cuando no hay señal</h3>
                <p>La experiencia offline te permite consultar información previamente disponible en ese dispositivo. Prepárala antes de perder la conexión.</p>
              </div>
            </article>
            <article className="ob-feature">
              <span className="ob-feature-icon"><Cloud size={22} aria-hidden="true" /></span>
              <span className="ob-feature-number ob-mono">05</span>
              <div className="ob-feature-content">
                <h3>Documentos compartidos</h3>
                <p>Los documentos de viaje compartidos cuentan con sincronización; son distintos de los archivos marcados Personal.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="ob-offline-section" aria-labelledby="ob-offline-title">
          <div className="ob-container ob-offline-grid">
            <div>
              <span className="ob-section-tag ob-mono">02 / Hecho para moverse</span>
              <h2 className="ob-display ob-section-title" id="ob-offline-title">La señal puede irse. Tu plan no tiene por qué hacerlo.</h2>
              <p className="ob-body">Un túnel, otra ciudad, una terminal sin cobertura. OffBunker está pensado para que la información ya guardada en tu dispositivo siga a mano.</p>
            </div>
            <div className="ob-offline-steps">
              <div className="ob-offline-step">
                <span className="ob-mono">01</span>
                <div><strong>Prepara antes de salir</strong><p>Organiza tu viaje y abre lo que necesitarás mientras tengas conexión.</p></div>
              </div>
              <div className="ob-offline-step">
                <span className="ob-mono">02</span>
                <div><strong>Consulta sobre la marcha</strong><p>Accede a la información disponible localmente aunque la red no acompañe.</p></div>
              </div>
              <div className="ob-offline-step">
                <span className="ob-mono">03</span>
                <div><strong>Retoma cuando vuelvas</strong><p>La sincronización de documentos compartidos depende de que recuperes la conexión.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="ob-privacy ob-container" id="privacidad" aria-labelledby="ob-privacy-title">
          <div className="ob-privacy-grid">
            <div className="ob-privacy-lead">
              <span className="ob-section-tag ob-mono">03 / Privacidad sin letra pequeña</span>
              <h2 className="ob-display ob-section-title" id="ob-privacy-title">Saber dónde está cada documento importa.</h2>
              <p className="ob-body">“Personal” y “compartido” no significan lo mismo. Te contamos la diferencia sin promesas que el producto no puede demostrar.</p>
              <p className="ob-privacy-note">Si guardas información sensible, protege también el acceso a tu dispositivo y revisa qué documentos decides compartir.</p>
            </div>
            <div className="ob-privacy-list">
              <div className="ob-privacy-row">
                <HardDrive size={23} aria-hidden="true" />
                <div><h3>Personal: solo en este dispositivo</h3><p>Los documentos móviles marcados Personal se almacenan únicamente en IndexedDB local del dispositivo. No se sincronizan con el servidor ni con otros dispositivos.</p></div>
              </div>
              <div className="ob-privacy-row">
                <Cloud size={23} aria-hidden="true" />
                <div><h3>Compartido: con sincronización</h3><p>Los documentos compartidos sí pueden sincronizarse para su uso en el viaje. Elige esta opción teniendo en cuenta esa diferencia.</p></div>
              </div>
              <div className="ob-privacy-row">
                <ShieldCheck size={23} aria-hidden="true" />
                <div><h3>Conexión y protección</h3><p>Cuando OffBunker se aloja bajo HTTPS, la conexión usa HTTPS. Esto no implica cifrado de extremo a extremo ni cifrado de archivos por la aplicación.</p></div>
              </div>
              <div className="ob-privacy-row">
                <Shield size={23} aria-hidden="true" />
                <div><h3>Cero anuncios</h3><p>OffBunker no muestra publicidad ni comercializa tus documentos con terceros.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="ob-plans" id="planes" aria-labelledby="ob-plans-title">
          <div className="ob-container">
            <div className="ob-plans-heading">
              <div>
                <span className="ob-section-tag ob-mono">04 / Lo que estamos explorando</span>
                <h2 className="ob-display ob-section-title" id="ob-plans-title">Un espacio para cada forma de viajar.</h2>
              </div>
              <p className="ob-body">El Plan Gratuito está disponible. Pro y Pase de Viaje son propuestas futuras, no productos contratables hoy.</p>
            </div>
            <div className="ob-proposal"><strong>Plan Gratuito disponible.</strong> Pro y Pase de Viaje aún no se pueden contratar; esta página no realiza cobros.</div>
            <div className="ob-plan-grid">
              <article className="ob-plan">
                <div className="ob-plan-top"><span className="ob-plan-label ob-mono">Una base para empezar</span><span className="ob-soon">Disponible</span></div>
                <h3>Gratuito</h3>
                <p>Hasta 2 viajes activos, con 2 acompañantes invitados por viaje y 50 MB de archivos compartidos en el servidor. Los documentos personales en el móvil no tienen límite impuesto por el plan: dependen del espacio disponible en tu dispositivo.</p>
                <div className="ob-plan-footer">Comparte tus viajes de forma segura con hasta 2 acompañantes sin coste adicional. Los enlaces públicos de solo lectura siguen disponibles.</div>
              </article>
              <article className="ob-plan">
                <div className="ob-plan-top"><span className="ob-plan-label ob-mono">Para quienes viajan más</span><span className="ob-soon">Próximamente</span></div>
                <h3>Pro</h3>
                <p>Propuesta de suscripción: viajes ilimitados, más espacio en la nube, digitalización inteligente y alertas de caducidad.</p>
                <div className="ob-plan-footer">Funciones, precio y contratación aún no disponibles.</div>
              </article>
              <article className="ob-plan">
                <div className="ob-plan-top"><span className="ob-plan-label ob-mono">Pensado para un viaje</span><span className="ob-soon">Próximamente</span></div>
                <h3>Pase de Viaje</h3>
                <p>Propuesta de pago único: funciones Pro durante 30 días para un viaje concreto, sin suscripción.</p>
                <div className="ob-plan-footer">Duración y condiciones propuestas; no es un pase activo.</div>
              </article>
            </div>
          </div>
        </section>

        <section className="ob-end" aria-labelledby="ob-end-title">
          <div className="ob-container">
            <span className="ob-section-tag ob-mono">Todo empieza antes de despegar</span>
            <h2 id="ob-end-title">Tu próxima salida, con la cabeza en el viaje.</h2>
            <p>Vuelve a lo esencial: saber dónde está cada cosa, incluso cuando necesitas consultarla deprisa.</p>
            <a className="ob-primary-link" href="#acceso">Acceder a OffBunker <ArrowRight size={17} aria-hidden="true" /></a>
          </div>
        </section>
      </main>

      <footer className="ob-footer">
        <div className="ob-container ob-footer-inner">
          <div>
            <a className="ob-logo" href="#inicio" aria-label="OffBunker, volver arriba">
              <span className="ob-logo-mark"><Shield size={17} aria-hidden="true" /></span>
              <span>OffBunker</span>
            </a>
            <p>Viajar con lo importante a mano.</p>
          </div>
          <nav className="ob-footer-links" aria-label="Navegación de pie de página">
            <a href="#funciones"><Plane size={13} aria-hidden="true" /> Funciones</a>
            <a href="#privacidad">Privacidad</a>
            <a href="#planes">Planes propuestos</a>
            <a href="#acceso">Acceder</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}