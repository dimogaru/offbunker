import { BedDouble, FileText, Plane, TrainFront, WifiOff, HardDrive } from "lucide-react";

export function PhoneMockup() {
  return (
    <figure className="ob-mock" aria-label="Ilustración de ejemplo: documentos e itinerario guardados en OffBunker">
      <div className="ob-mock-phone" aria-hidden="true">
        <div className="ob-mock-status"><span>09:41</span><span className="ob-mock-air"><Plane size={11} /> Modo avión</span></div>
        <div className="ob-mock-trip">
          <span className="ob-mono">Ejemplo · Viaje a Lisboa</span>
          <strong>12–16 oct</strong>
        </div>
        <div className="ob-mock-label">Documentos</div>
        <ul className="ob-mock-docs">
          <li><FileText size={15} /><span><b>Tarjeta de embarque</b><i>Vuelo de ejemplo · PDF</i></span><em>En dispositivo</em></li>
          <li><HardDrive size={15} /><span><b>Pasaporte</b><i>Marcado Personal</i></span><em className="ob-mock-personal">Personal</em></li>
          <li><BedDouble size={15} /><span><b>Reserva de hotel</b><i>Confirmación · PDF</i></span><em>En dispositivo</em></li>
        </ul>
        <div className="ob-mock-label">Itinerario</div>
        <ol className="ob-mock-timeline">
          <li><span>07:15</span><Plane size={13} /> Salida desde la terminal 2</li>
          <li><span>10:40</span><TrainFront size={13} /> Metro al centro</li>
          <li><span>14:00</span><BedDouble size={13} /> Check-in en el hotel</li>
        </ol>
      </div>
      <figcaption className="ob-mock-badge">
        <WifiOff size={17} aria-hidden="true" />
        <span><strong>Consulta en modo avión</strong><small>Información y archivos preparados en este dispositivo.</small></span>
      </figcaption>
      <p className="ob-mock-note">Ilustración con datos de ejemplo.</p>
    </figure>
  );
}
