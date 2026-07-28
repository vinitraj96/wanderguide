import { NextRequest, NextResponse } from "next/server";
import { findDestination, places } from "@/lib/data";

type Day = {
  date: string;
  max: number;
  min: number;
  rain: number;
  code: number;
};

type WeatherResult = {
  days: Day[];
};

type OpenMeteoResponse = {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
};

async function wx(lat: number, lon: number): Promise<WeatherResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("past_days", "7");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
  );
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url, {
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    throw new Error(`Weather API ${response.status}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;

  const days: Day[] = data.daily.time.map(
    (date: string, index: number): Day => ({
      date,
      max: Math.round(data.daily.temperature_2m_max[index]),
      min: Math.round(data.daily.temperature_2m_min[index]),
      rain:
        Math.round(
          (data.daily.precipitation_sum[index] || 0) * 10
        ) / 10,
      code: data.daily.weather_code[index],
    })
  );

  return { days };
}

function score(day: Day): number {
  const badWeatherCodes = [
    65,
    80,
    81,
    82,
    95,
    96,
    99,
  ];

  return Math.max(
    0,
    Math.min(
      100,
      100 -
        Math.min(day.rain * 4, 40) -
        Math.max(0, day.max - 34) * 2 -
        (badWeatherCodes.includes(day.code) ? 15 : 0)
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug") || "";

    const destination = findDestination(slug);

    if (!destination) {
      return NextResponse.json(
        { error: "Destination not found" },
        { status: 404 }
      );
    }

    // Selected destination weather
    const weather = await wx(
      destination.lat,
      destination.lon
    );

    const futureDays: Day[] = weather.days.slice(7);

    const decisionScore = Math.round(
      futureDays.reduce(
        (total: number, day: Day) =>
          total + score(day),
        0
      ) / Math.max(futureDays.length, 1)
    );

    // Top destinations in selected state/province
    const regionalPlaces = places(
      destination.country,
      destination.region
    ).slice(0, 10);

    const predictedPlaces = await Promise.all(
      regionalPlaces.map(async (place) => {
        try {
          const placeWeather = await wx(
            place.lat,
            place.lon
          );

          const nextDays: Day[] =
            placeWeather.days.slice(7);

          const placeScore = Math.round(
            nextDays.reduce(
              (total: number, day: Day) =>
                total + score(day),
              0
            ) / Math.max(nextDays.length, 1)
          );

          return {
            ...place,
            score: placeScore,
          };
        } catch {
          return {
            ...place,
            score: 0,
          };
        }
      })
    );

    predictedPlaces.sort(
      (
        a: (typeof predictedPlaces)[number],
        b: (typeof predictedPlaces)[number]
      ) => b.score - a.score
    );

    return NextResponse.json({
      destination,
      weather,
      decisionScore,
      predictedPlaces,
    });
  } catch (error) {
    console.error("Destination API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Weather failed",
      },
      { status: 502 }
    );
  }
}