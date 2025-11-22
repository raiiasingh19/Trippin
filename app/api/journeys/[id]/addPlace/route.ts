import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import connectMongo from "@/lib/mongodb";
import Journey from "@/models/Journey";
import User from "@/models/User";
import Place from "@/models/Place";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// POST /api/journeys/:id/addPlace
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

  await connectMongo();
  const user = await User.findOne({ email: session.user?.email });
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const { id } = context.params;
  const body = await request.json();
  if (!body) return NextResponse.json({ message: "Missing body" }, { status: 400 });

  // body can be { placeId } or { place: {...} }
  let placeName = "";
  if (body.placeId) {
    const p = await Place.findById(body.placeId);
    if (!p) return NextResponse.json({ message: "Place not found" }, { status: 404 });
    placeName = p.name;
  } else if (body.place && body.place.name) {
    placeName = body.place.name;
  } else {
    return NextResponse.json({ message: "Missing place info" }, { status: 400 });
  }

  // find journey owned by user
  const journey = await Journey.findOne({ _id: id, userId: user._id });
  if (!journey) return NextResponse.json({ message: "Journey not found" }, { status: 404 });

  journey.waypoints = journey.waypoints || [];
  journey.waypoints.push(placeName);

  // also update itinerary: append a readable entry so itinerary reflects the new stop
  const entry = `${placeName}: Added via Explore`;
  if (!journey.itinerary) journey.itinerary = entry;
  else journey.itinerary = `${journey.itinerary}\n${entry}`;

  // add a placeholder stopTime for the new stop to keep arrays aligned
  journey.stopTimes = journey.stopTimes || [];
  journey.stopTimes.push({ arriveBy: "", leaveBy: "" });

  await journey.save();

  return NextResponse.json({ message: "added", journey }, { status: 200 });
}
