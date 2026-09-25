import type { SharedTrip } from "@workspace/api-client-react";

export const DEMO_PUBLIC_SHARE_TOKEN = "demo-tokio";
export const DEMO_PUBLIC_SHARE_PATH = `/share/${DEMO_PUBLIC_SHARE_TOKEN}`;

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Public sample only: this never reads a visitor's demo session or its database records.
export function getDemoPublicTrip(): SharedTrip {
  const startDate = dateOffset(7);
  const endDate = dateOffset(10);
  const createdAt = new Date().toISOString();

  return {
    trip: {
      id: 0,
      name: "Exploración de Tokio",
      destination: "Tokio, Japón",
      startDate,
      endDate,
      status: "upcoming",
      coverImage: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
      notes: "Viaje de muestra para explorar OffBunker.",
      createdAt,
    },
    flights: [{
      id: 1,
      tripId: 0,
      airline: "Ejemplo Air",
      flightNumber: "EA 204",
      departureAirport: "LAX",
      arrivalAirport: "HND",
      departureTime: `${startDate}T09:30:00.000Z`,
      arrivalTime: `${startDate}T17:45:00.000Z`,
      terminal: "Muestra",
      gate: "—",
      seat: "—",
      createdAt,
    }],
    parkings: [],
    rentals: [],
    accommodations: [{
      id: 1,
      tripId: 0,
      name: "Hotel de muestra en Shinjuku",
      type: "hotel",
      bookingPlatform: "Ejemplo",
      address: "Shinjuku, Tokio, Japón",
      checkIn: `${startDate}T15:00:00.000Z`,
      checkOut: `${endDate}T11:00:00.000Z`,
      confirmationCode: "DEMO-0000",
      notes: "Reserva ficticia para explorar la aplicación.",
      createdAt,
    }],
    itinerary: [
      {
        id: 1,
        tripId: 0,
        date: startDate,
        time: "10:00",
        title: "Llegada y traslado al hotel",
        description: "Deja el equipaje y tómate un momento para descansar.",
        location: "Shinjuku",
        category: "transport",
        createdAt,
      },
      {
        id: 2,
        tripId: 0,
        date: startDate,
        time: "18:30",
        title: "Paseo por Shinjuku",
        description: "Explora las calles y disfruta de una cena local.",
        location: "Shinjuku, Tokio",
        category: "activity",
        createdAt,
      },
      {
        id: 3,
        tripId: 0,
        date: dateOffset(8),
        time: "09:00",
        title: "Visita a Asakusa",
        description: "Recorre el templo Sensō-ji y sus alrededores.",
        location: "Asakusa, Tokio",
        category: "activity",
        createdAt,
      },
    ],
  };
}