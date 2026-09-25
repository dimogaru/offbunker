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
  Link2,
  Luggage,
  MapPinned,
  Plane,
  Shield,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Check,
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
  const { login, register, loginDemo } = useAuth();
  const isOnline = useOnlineStatus();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);

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
      const user = creatingAccount
        ? await register(username.trim(), password)
        : await login(username.trim(), password);
      if (user.role === "superadmin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast({
        title: creatingAccount ? "No se pudo crear la cuenta" : isOnline ? "Error de inicio de sesión" : "Error de acceso offline",
        description:
          err instanceof Error ? err.message : "Credenciales incorrectas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    if (loading || demoLoading) return;
    setDemoLoading(true);
    try {
      await loginDemo();
      navigate("/");
    } catch (err) {
      toast({
        title: "No se pudo iniciar el Modo Demo",
        description: err instanceof Error ? err.message : "Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
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
            <a href="#compartir">Compartir</a>
            <a href="#instalar">Instalar</a>
            <a href="#privacidad">Privacidad</a>
            <a href="#planes">Planes</a>
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
                en tu dispositivo cuando la conexión falle. Invita a tus acompañantes a
                planificar contigo o comparte un enlace público para consultar el viaje sin registro.
                También puedes instalar OffBunker en tu móvil desde el navegador.
              </p>
              <div className="ob-hero-actions">
                <a className="ob-primary-link" href="#acceso">
                  <span>Entrar a mi espacio</span><ArrowRight size={17} aria-hidden="true" />
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
                  <h2>{creatingAccount ? "Crea tu espacio gratuito." : "Bienvenido de nuevo."}</h2>
                  <p className="ob-login-description">
                    {creatingAccount
                      ? "Solo necesitas un nombre de usuario y una contraseña. Tu Plan Gratuito estará activo al entrar."
                      : isOnline
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
                        minLength={creatingAccount ? 3 : undefined}
                        maxLength={creatingAccount ? 32 : undefined}
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
                        placeholder={creatingAccount ? "Mínimo 8 caracteres" : "••••••••"}
                        autoComplete={creatingAccount ? "new-password" : "current-password"}
                        minLength={creatingAccount ? 8 : undefined}
                        maxLength={creatingAccount ? 128 : undefined}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="ob-login-submit w-full gap-2" disabled={loading || demoLoading || (creatingAccount && !isOnline)}>
                      {loading ? (
                        creatingAccount ? "Creando cuenta…" : "Iniciando sesión…"
                      ) : (
                        <>
                          <LogIn size={17} aria-hidden="true" />
                          {creatingAccount ? "Crear cuenta gratuita" : isOnline ? "Iniciar sesión" : "Acceder sin conexión"}
                        </>
                      )}
                    </Button>
                  </form>
                  <button
                    type="button"
                    className="mt-4 w-full text-center text-sm font-semibold text-[#246c70] underline underline-offset-4 hover:text-[#113f46] disabled:opacity-50"
                    disabled={loading || demoLoading || (!creatingAccount && !isOnline)}
                    onClick={() => {
                      setCreatingAccount(!creatingAccount);
                      setPassword("");
                    }}
                  >
                    {creatingAccount ? "¿Ya tienes cuenta? Iniciar sesión" : "¿Aún no tienes cuenta? Crear cuenta gratuita"}
                  </button>
                  <div className="mt-6 border-t border-[#d4e5db] pt-5">
                    <p className="mb-3 text-center text-xs text-[#587274]">O explora un viaje de ejemplo sin registrarte.</p>
                    <Button type="button" variant="outline" className="h-12 w-full gap-2 border-[#246c70] bg-[#eaf3ec] font-semibold text-[#113f46] hover:bg-[#dcebe2]" onClick={handleDemo} disabled={!isOnline || loading || demoLoading}>
                      <UsersRound className="h-4 w-4" aria-hidden="true" />
                      {demoLoading ? "Preparando tu demo…" : "Probar como Invitado"}
                    </Button>
                    <p className="mt-2 text-center text-xs text-[#69817e]">Sesión temporal con datos de ejemplo. Requiere conexión.</p>
                  </div>
                </div>
                <div className="ob-login-card-foot">
                  <KeyRound size={14} aria-hidden="true" />
                  <span>Crea tu cuenta gratuita, entra en tu espacio o prueba OffBunker sin registrarte.</span>
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

        <section className="border-y border-[#cadbd6] bg-[#edf3ec] py-20 md:py-28" id="compartir" aria-labelledby="ob-sharing-title">
          <div className="ob-container">
            <div className="mb-10 max-w-3xl md:mb-12">
              <span className="ob-section-tag ob-mono">02 / Comparte a tu manera</span>
              <h2 className="ob-display ob-section-title" id="ob-sharing-title">Juntos para planificar. Un enlace para estar al día.</h2>
              <p className="ob-body mt-5">
                Elige quién puede colaborar dentro de tu viaje y quién solo necesita consultar el plan. Son dos formas distintas de compartir.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <article className="flex h-full flex-col rounded-lg border border-[#bad2ca] bg-[#fafbf6] p-6 shadow-sm sm:p-8">
                <div className="mb-7 flex items-center justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#e0eee6] text-[#246c70]"><UsersRound size={24} aria-hidden="true" /></span>
                  <span className="ob-mono text-[#246c70]">Participan y editan</span>
                </div>
                <h3 className="ob-display text-2xl sm:text-3xl">Colaboración en Grupo</h3>
                <p className="ob-body mt-4">Invita a tus acompañantes a entrar al Búnker y planificad juntos el itinerario.</p>
                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[#47676a]">
                  <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[#246c70]" size={18} aria-hidden="true" /><span>Con permiso de edición, cada invitado puede añadir y gestionar sus billetes, reservas y documentos compartidos del viaje.</span></li>
                  <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[#246c70]" size={18} aria-hidden="true" /><span>Hasta <strong>2 colaboradores invitados</strong> por viaje en el Plan Gratuito: 3 miembros contando al creador.</span></li>
                </ul>
                <p className="mt-auto border-t border-[#d6e2d8] pt-5 text-xs leading-relaxed text-[#587274]">Los invitados de solo lectura no pueden editar; el propietario decide el permiso de cada colaborador.</p>
              </article>

              <article className="flex h-full flex-col rounded-lg border border-[#a8cabe] bg-[#dcece5] p-6 shadow-sm sm:p-8">
                <div className="mb-7 flex items-center justify-between gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#f1f8ec] text-[#246c70]"><Link2 size={24} aria-hidden="true" /></span>
                  <span className="ob-mono text-[#246c70]">Consultan sin cuenta</span>
                </div>
                <h3 className="ob-display text-2xl sm:text-3xl">Enlace Público en 1 Clic</h3>
                <p className="ob-body mt-4">Genera un enlace web a una página limpia con el resumen del viaje: horarios, desplazamientos, alojamiento e itinerario.</p>
                <ul className="mt-6 space-y-3 text-sm leading-relaxed text-[#47676a]">
                  <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[#246c70]" size={18} aria-hidden="true" /><span>Familiares y amigos pueden consultar el plan <strong>sin registrarse</strong>, pero no editarlo.</span></li>
                  <li className="flex gap-3"><Check className="mt-0.5 shrink-0 text-[#246c70]" size={18} aria-hidden="true" /><span><strong>Sin límite de consultas</strong> del enlace público de cada viaje en el Plan Gratuito; no cuenta como colaborador invitado.</span></li>
                </ul>
                <p className="mt-auto border-t border-[#bad2ca] pt-5 text-xs leading-relaxed text-[#587274]">Cualquier persona con el enlace puede ver el resumen. No incluye tus documentos Personal guardados en el móvil.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-b border-[#cadbd6] bg-[#f0f5ed] py-20 md:py-28" id="instalar" aria-labelledby="ob-install-title">
          <div className="ob-container grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
            <div>
              <span className="ob-section-tag ob-mono">03 / OffBunker en tu móvil</span>
              <h2 className="ob-display ob-section-title" id="ob-install-title">Instalación Instantánea sin Pasar por las Tiendas de Apps</h2>
              <p className="ob-body mt-6 max-w-2xl">
                Abre OffBunker en el navegador de tu móvil y añádelo a la pantalla de inicio.
                Tendrás su propio icono y podrás abrirlo en una ventana independiente, con una
                experiencia similar a la de una app instalada, sin buscarlo en App Store ni Google Play.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#cadbd6] bg-[#fcfcf7] p-5">
                  <span className="ob-mono text-[#246c70]">iPhone · Safari</span>
                  <p className="mt-2 text-sm leading-relaxed text-[#47676a]">Abre el menú <strong>Compartir</strong> y elige <strong>«Añadir a la pantalla de inicio»</strong>.</p>
                </div>
                <div className="rounded-lg border border-[#cadbd6] bg-[#fcfcf7] p-5">
                  <span className="ob-mono text-[#246c70]">Android · Chrome</span>
                  <p className="mt-2 text-sm leading-relaxed text-[#47676a]">Abre el menú del navegador y elige <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.</p>
                </div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-[#587274]">La opción de instalación depende del navegador y requiere una conexión segura. Como cualquier app, sus archivos y datos ocupan espacio en el dispositivo.</p>
            </div>
            <div className="rounded-[28px] border border-[#315f61] bg-[#113f46] p-6 text-[#f6f5ed] shadow-xl sm:p-8">
              <div className="mb-7 flex items-center gap-3 border-b border-white/20 pb-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#d9e6ba] text-[#113f46]"><Shield size={23} aria-hidden="true" /></span>
                <div>
                  <span className="ob-mono text-[#badac6]">Tu búnker, siempre a mano</span>
                  <p className="font-semibold">Una app web para llevar contigo</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <Smartphone className="mt-1 shrink-0 text-[#d9e6ba]" size={23} aria-hidden="true" />
                  <div><h3 className="font-semibold">Icono e interfaz de app</h3><p className="mt-1 text-sm leading-relaxed text-[#b9d1cc]">Accede desde tu pantalla de inicio y ábrela sin la barra habitual del navegador.</p></div>
                </div>
                <div className="flex gap-4">
                  <WifiOff className="mt-1 shrink-0 text-[#d9e6ba]" size={23} aria-hidden="true" />
                  <div><h3 className="font-semibold">Acceso offline preparado</h3><p className="mt-1 text-sm leading-relaxed text-[#b9d1cc]">Consulta itinerarios y documentos que ya estén disponibles en ese dispositivo cuando no tengas cobertura.</p></div>
                </div>
                <div className="flex gap-4">
                  <HardDrive className="mt-1 shrink-0 text-[#d9e6ba]" size={23} aria-hidden="true" />
                  <div><h3 className="font-semibold">Búnker privado local</h3><p className="mt-1 text-sm leading-relaxed text-[#b9d1cc]">Las subidas marcadas Personal permanecen solo en este dispositivo y no se sincronizan con el servidor ni con otros móviles.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ob-offline-section" aria-labelledby="ob-offline-title">
          <div className="ob-container ob-offline-grid">
            <div>
              <span className="ob-section-tag ob-mono">04 / Hecho para moverse</span>
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
              <span className="ob-section-tag ob-mono">05 / Privacidad sin letra pequeña</span>
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
                <div><h3>Conexión segura y acceso bajo tu control</h3><p>Al usar OffBunker bajo HTTPS, la comunicación entre tu dispositivo y el servidor viaja cifrada durante el tránsito. Solo el creador de un viaje puede invitar colaboradores; también puede crear un enlace público de solo lectura que permite consultar el viaje a cualquiera que lo tenga. Los documentos marcados Personal se quedan en tu dispositivo.</p></div>
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
                <span className="ob-section-tag ob-mono">06 / Tu plan, a tu ritmo</span>
                <h2 className="ob-display ob-section-title" id="ob-plans-title">Un espacio para cada forma de viajar.</h2>
              </div>
              <p className="ob-body">El Plan Gratuito está disponible. Pro y Pase de Viaje son propuestas futuras, no productos contratables hoy.</p>
            </div>
            <div className="ob-proposal"><strong>Plan Gratuito disponible.</strong> Pro y Pase de Viaje aún no se pueden contratar; esta página no realiza cobros.</div>
            <div className="ob-plan-grid">
              <article className="ob-plan">
                <div className="ob-plan-top"><span className="ob-plan-label ob-mono">Una base para empezar</span><span className="ob-soon">Disponible</span></div>
                <h3>Gratuito</h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#55706a]">
                  <li><strong>2 viajes activos</strong> creados como máximo.</li>
                  <li><strong>Colaboración completa</strong> con hasta 2 acompañantes invitados por viaje: 3 miembros en total.</li>
                  <li><strong>Enlace público de solo lectura por viaje, sin límite de consultas</strong>, para mostrar el resumen sin registro.</li>
                  <li><strong>Hasta 50 MB</strong> de almacenamiento en el servidor para documentos compartidos.</li>
                  <li><strong>Subidas personales en la app móvil: 100 % locales y sin cuota del plan.</strong> No se sincronizan; dependen del espacio disponible en el dispositivo.</li>
                </ul>
                <div className="ob-plan-footer">Comparte tus viajes con hasta 2 acompañantes sin coste adicional. El enlace público es para consultar, no para editar.</div>
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
            <a href="#instalar">Instalar en móvil</a>
            <a href="#privacidad">Privacidad</a>
            <a href="#compartir">Formas de compartir</a>
            <a href="#planes">Planes</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}