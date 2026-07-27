import { NextResponse } from 'next/server';

// OSRM cycling directions proxy
// Returns realistic bike-route distance and duration between two coordinates
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const olat = searchParams.get('olat');
  const olng = searchParams.get('olng');
  const dlat = searchParams.get('dlat');
  const dlng = searchParams.get('dlng');

  if (!olat || !olng || !dlat || !dlng) {
    return NextResponse.json({ error: 'Missing coordinates. Required: olat, olng, dlat, dlng' }, { status: 400 });
  }

  try {
    // OSRM expects lng,lat order (opposite of typical lat,lng)
    const url = `https://router.project-osrm.org/route/v1/bike/${olng},${olat};${dlng},${dlat}?overview=false`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'HOMETRACKER/1.0' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`OSRM returned status ${res.status}`);
    }

    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const distance_km = Math.round((route.distance / 1000) * 10) / 10; // meters -> km, 1 decimal
    const duration_min = Math.ceil(route.duration / 60); // seconds -> minutes, rounded up

    return NextResponse.json({ distance_km, duration_min });
  } catch (e) {
    console.warn('OSRM routing failed, using Haversine fallback:', e.message);

    // Haversine fallback
    const R = 6371;
    const dLat = ((dlat - olat) * Math.PI) / 180;
    const dLon = ((dlng - olng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((olat * Math.PI) / 180) * Math.cos((dlat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const straightLineKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Apply 1.4x road factor for cycling, assume 15 km/h average bike speed
    const roadKm = straightLineKm * 1.4;
    const mins = Math.ceil((roadKm / 15) * 60);

    return NextResponse.json({
      distance_km: Math.round(roadKm * 10) / 10,
      duration_min: Math.max(1, mins),
      fallback: true,
    });
  }
}
