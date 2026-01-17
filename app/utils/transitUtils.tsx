// utils/transitUtils.ts

type Row = { title: string; description?: string };

export async function getTransitItinerary(
  segmentPoints: string[],
  svc: google.maps.DirectionsService,
  origin: string,
  originTime: Date,                // ← type updated
  destination: string,
  destinationTime: Date,           // ← type updated (unused but kept for signature)
  waypoints: string[],
  stopTimes: { arriveBy: string; leaveBy: string }[]
): Promise<{
  itinerary: Row[];
  segmentInfos: any[];
  directionsSegments: google.maps.DirectionsResult[];
}> {
  const combineDate = (base: Date, hhmm?: string): Date | undefined => {
    if (!hhmm) return undefined;
    const [hh, mm] = hhmm.split(":").map((v) => parseInt(v, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
    const d = new Date(base);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  // Helper: route a single slice with fallbacks (BUS → generic TRANSIT → WALKING)
  const routeSlice = (a: string, b: string, opts?: { departAt?: Date; arriveBy?: Date }) =>
    new Promise<google.maps.DirectionsResult>((resolve, reject) => {
      const tryGenericTransit = () =>
        svc.route(
          {
            origin: a,
            destination: b,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: {
              routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
              ...(opts?.departAt ? { departureTime: opts.departAt } : {}),
              ...(opts?.arriveBy && !opts?.departAt ? { arrivalTime: opts.arriveBy } : {}),
            },
          },
          (r2, s2) => {
            if (s2 === google.maps.DirectionsStatus.OK && r2) {
              resolve(r2);
            } else {
              // Final fallback: WALKING (to avoid hard failure)
              svc.route(
                {
                  origin: a,
                  destination: b,
                  travelMode: google.maps.TravelMode.WALKING,
                },
                (r3, s3) => {
                  if (s3 === google.maps.DirectionsStatus.OK && r3) resolve(r3);
                  else reject(s3);
                }
              );
            }
          }
        );

      // First attempt: BUS only
          svc.route(
            {
          origin: a,
          destination: b,
              travelMode: google.maps.TravelMode.TRANSIT,
              transitOptions: {
                modes: [google.maps.TransitMode.BUS],
                routingPreference: google.maps.TransitRoutePreference.LESS_WALKING,
            ...(opts?.departAt ? { departureTime: opts.departAt } : {}),
            ...(opts?.arriveBy && !opts?.departAt ? { arrivalTime: opts.arriveBy } : {}),
          },
        },
        (r1, s1) => {
          if (s1 === google.maps.DirectionsStatus.OK && r1) resolve(r1);
          else tryGenericTransit();
        }
      );
    });

  // 1) fetch each slice sequentially with fallbacks and carry forward arrival times
  const legs: google.maps.DirectionsResult[] = [];
  let lastArrival: Date | undefined = originTime;
  for (let i = 0; i < segmentPoints.length - 1; i++) {
    let departAt: Date | undefined = undefined;
    let arriveBy: Date | undefined = undefined;
    // First slice: honor originTime as departure
    if (i === 0) {
      departAt = originTime;
    }
    // If we have stopTimes for the stop just before this slice, prefer leaveBy
    if (i - 1 >= 0 && stopTimes[i - 1]) {
      const st = stopTimes[i - 1];
      const leave = combineDate(originTime, st.leaveBy);
      const arrive = combineDate(originTime, st.arriveBy);
      departAt = leave || departAt || arrive || lastArrival || departAt;
    } else if (!departAt && lastArrival) {
      departAt = lastArrival;
    }
    // Final slice into destination: if destinationTime is provided, try to honor arrival
    if (i === segmentPoints.length - 2 && destinationTime) {
      if (!departAt) arriveBy = destinationTime;
    }
    // eslint-disable-next-line no-await-in-loop
    const res = await routeSlice(segmentPoints[i], segmentPoints[i + 1], {
      departAt,
      arriveBy,
    });
    legs.push(res);
    try {
      const leg = res.routes?.[0]?.legs?.[0] as any;
      if (leg?.arrival_time?.value) {
        const v = leg.arrival_time.value;
        lastArrival = v instanceof Date ? v : new Date(v);
      }
    } catch {
      // ignore bad arrival parsing
    }
  }

  const rows: Row[] = [];
  const segmentInfos: any[] = [];
  const directionsSegments: google.maps.DirectionsResult[] = [];

  const first = (s: string) => s.split(",")[0] || s;

  // Origin: just the title
  rows.push({ title: first(origin) });

  for (let idx = 0; idx < legs.length; idx++) {
    const result = legs[idx];
    const leg = result.routes[0].legs[0];
    directionsSegments.push(result);

    // emit each step in this leg
    for (const step of leg.steps) {
      if (step.travel_mode === google.maps.TravelMode.WALKING) {
        rows.push({
          title: "Walk",
          description: `Walk ${step.distance?.text} (${step.duration?.text})`,
        });
      } else if (step.travel_mode === google.maps.TravelMode.TRANSIT) {
        const t = (step as google.maps.DirectionsStep).transit;
        if (!t) continue;

        const bus = t.line.short_name ?? t.line.name;

        // Board
        rows.push({
          title: `Bus ${bus} – Board`,
          description: `Board at ${first(t.departure_stop.name)} @ ${t.departure_time.text}`,
        });

        // Ride
        rows.push({
          title: `Ride Bus ${bus}`,
          description: `Ride for ${step.distance?.text} (${step.duration?.text})`,
        });

        // Alight
        rows.push({
          title: `Bus ${bus} – Alight`,
          description: `Alight at ${first(t.arrival_stop.name)} @ ${t.arrival_time.text}`,
        });
      }
    }

    // separator except after last slice
    if (idx < legs.length - 1) {
      rows.push({ title: "" });
    }

    // collect map‐center info
    segmentInfos.push({
      position: {
        lat: (leg.start_location.lat() + leg.end_location.lat()) / 2,
        lng: (leg.start_location.lng() + leg.end_location.lng()) / 2,
      },
      duration: leg.duration?.text || "",
    });
  }

  // Destination: just the title
  rows.push({ title: first(destination) });

  return { itinerary: rows, segmentInfos, directionsSegments };
}
