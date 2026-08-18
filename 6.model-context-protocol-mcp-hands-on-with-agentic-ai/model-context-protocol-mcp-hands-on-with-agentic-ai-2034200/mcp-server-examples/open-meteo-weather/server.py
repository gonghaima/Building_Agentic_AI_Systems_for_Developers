from typing import Any
import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("weather")

# Constants
OPENMETEO_API_BASE = "https://api.open-meteo.com/v1"
USER_AGENT = "weather-app/1.0"

async def make_openmeteo_request(url: str) -> dict[str, Any] | None:
    """Make a request to the Open-Meteo API with proper error handling."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            return None

@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get weather forecast for a location.

    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
    """
    url = f"{OPENMETEO_API_BASE}/forecast?latitude={latitude}&longitude={longitude}&hourly=temperature_2m,precipitation,weathercode&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto"
    data = await make_openmeteo_request(url)

    if not data:
        return "Unable to fetch forecast data for this location."

    # Format the daily forecast into a readable format
    daily = data["daily"]
    forecasts = []
    for i in range(len(daily["time"])):
        forecast = f"""
Date: {daily['time'][i]}
Max Temperature: {daily['temperature_2m_max'][i]}°C
Min Temperature: {daily['temperature_2m_min'][i]}°C
Precipitation: {daily['precipitation_sum'][i]} mm
Weather Code: {daily['weathercode'][i]}
"""
        forecasts.append(forecast)

    return "\n---\n".join(forecasts)

@mcp.tool()
async def get_current_weather(latitude: float, longitude: float) -> str:
    """Get current weather for a location.

    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
    """
    
    # https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m&current=temperature_2m,is_day,showers,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl,snowfall,precipitation,relative_humidity_2m,apparent_temperature,rain,weather_code,surface_pressure,wind_gusts_10m
    url = f"{OPENMETEO_API_BASE}/forecast?latitude={latitude}&longitude={longitude}&current=temperature_2m,is_day,showers,cloud_cover,wind_speed_10m,wind_direction_10m,pressure_msl,snowfall,precipitation,relative_humidity_2m,apparent_temperature,rain,weather_code,surface_pressure,wind_gusts_10m"
    #url = f"{OPENMETEO_API_BASE}/forecast?latitude={latitude}&longitude={longitude}&current_weather=true&timezone=auto"
    data = await make_openmeteo_request(url)

    if not data:
        return "Unable to fetch current weather data for this location."

    return data

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')