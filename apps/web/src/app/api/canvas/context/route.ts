import { NextRequest, NextResponse } from "next/server";

interface UserContext {
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  city: string;
  country: string;
  season: "spring" | "summer" | "autumn" | "winter";
  weather: string;
  greeting: string;
}

function getTimeOfDay(hour: number): UserContext["timeOfDay"] {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getSeason(month: number, isNorthernHemisphere: boolean): UserContext["season"] {
  // Adjust for hemisphere
  const adjustedMonth = isNorthernHemisphere ? month : (month + 6) % 12;

  if (adjustedMonth >= 2 && adjustedMonth < 5) return "spring";
  if (adjustedMonth >= 5 && adjustedMonth < 8) return "summer";
  if (adjustedMonth >= 8 && adjustedMonth < 11) return "autumn";
  return "winter";
}

function getWeatherDescription(season: UserContext["season"], timeOfDay: UserContext["timeOfDay"]): string {
  const winterDescriptions = ["chilly", "cold", "frosty", "snowy", "crisp"];
  const summerDescriptions = ["warm", "sunny", "bright", "balmy"];
  const springDescriptions = ["fresh", "mild", "breezy"];
  const autumnDescriptions = ["crisp", "cool", "golden"];

  const descriptions = {
    winter: winterDescriptions,
    summer: summerDescriptions,
    spring: springDescriptions,
    autumn: autumnDescriptions,
  };

  const options = descriptions[season];
  return options[Math.floor(Math.random() * options.length)];
}

function generateGreeting(context: Omit<UserContext, "greeting">): string {
  const timeGreetings = {
    morning: ["Good morning", "Morning", "Rise and shine"],
    afternoon: ["Hey there", "Good afternoon", "Afternoon"],
    evening: ["Good evening", "Evening", "Hey"],
    night: ["Late night, huh", "Burning the midnight oil", "Night owl"],
  };

  const timeGreeting = timeGreetings[context.timeOfDay][Math.floor(Math.random() * 3)];

  // Build contextual greeting
  if (context.city && context.city !== "Unknown") {
    return `${timeGreeting}! ${context.weather} ${context.timeOfDay} in ${context.city}.`;
  }

  return `${timeGreeting}! Looks like a ${context.weather} ${context.timeOfDay}.`;
}

export async function GET(request: NextRequest) {
  try {
    // Get current time
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();

    // Try to get location from IP
    let city = "Unknown";
    let country = "Unknown";
    let isNorthernHemisphere = true;

    // Get IP from headers (works with most hosting providers)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      try {
        // Use ip-api.com for free geolocation (no API key needed)
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,lat`);
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          city = geoData.city || "Unknown";
          country = geoData.country || "Unknown";
          // Determine hemisphere from latitude
          isNorthernHemisphere = (geoData.lat || 0) >= 0;
        }
      } catch (geoError) {
        console.error("Geolocation failed:", geoError);
      }
    }

    const timeOfDay = getTimeOfDay(hour);
    const season = getSeason(month, isNorthernHemisphere);
    const weather = getWeatherDescription(season, timeOfDay);

    const contextWithoutGreeting = {
      timeOfDay,
      city,
      country,
      season,
      weather,
    };

    const context: UserContext = {
      ...contextWithoutGreeting,
      greeting: generateGreeting(contextWithoutGreeting),
    };

    return NextResponse.json(context);
  } catch (error) {
    console.error("Error getting context:", error);

    // Return fallback context
    return NextResponse.json({
      timeOfDay: "afternoon",
      city: "Unknown",
      country: "Unknown",
      season: "winter",
      weather: "chilly",
      greeting: "Hey there! Ready to create something?",
    });
  }
}
