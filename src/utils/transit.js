const { ApiError } = require('./errors');

const HSL_ENDPOINT = "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";

/**
 * Fetches a travel plan between two coordinates using the Digitransit API.
 * @param {Object} from - { lat, lon }
 * @param {Object} to - { lat, lon }
 * @returns {Promise<Object>} The formatted itinerary for ESP32
*/
async function getTravelPlan(from, to) {
    const API_KEY = process.env.DIGITRANSIT_API_KEY;
    if (!API_KEY) {
        console.warn('DIGITRANSIT_API_KEY is not set. Transit features will not work.');
        return null;
    }

    if (!from?.lat || !from?.lon || !to?.lat || !to?.lon) {
        throw new ApiError(400, 'Invalid coordinates provided for travel plan');
    }

    // Using the verified planConnection structure for Digitransit v2
    // UPDATED: Variable types changed from Float! to CoordinateValue! per API requirement
    const query = `
    query GetSmartHookPlan($fromLat: CoordinateValue!, $fromLon: CoordinateValue!, $toLat: CoordinateValue!, $toLon: CoordinateValue!) {
      planConnection(
        origin: { location: { coordinate: { latitude: $fromLat, longitude: $fromLon } }, label: "Origin" }
        destination: { location: { coordinate: { latitude: $toLat, longitude: $toLon } }, label: "Destination" }
        first: 1
      ) {
        edges {
          node {
            start
            duration
            legs {
              mode
              start { estimated { time } }
              realtimeState
              route { shortName }
            }
          }
        }
      }
    }`;

    const variables = {
        fromLat: from.lat,
        fromLon: from.lon,
        toLat: to.lat,
        toLon: to.lon,
    };

    try {
        const response = await fetch(HSL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'digitransit-subscription-key': API_KEY,
            },
            body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
            throw new Error(`Digitransit API responded with status ${response.status}`);
        }

        const json = await response.json();

        if (json.errors) {
            console.error('HSL API Data Errors:', JSON.stringify(json.errors, null, 2));
            return null;
        }

        // Navigation through the edges/node structure
        const itinerary = json.data?.planConnection?.edges?.[0]?.node;

        if (!itinerary) {
            console.log('No itineraries found.');
            return null;
        }

        // Find the actual transport leg (ignore the initial walk)
        const vehicleLeg = itinerary.legs.find((leg) => leg.mode !== 'WALK') || itinerary.legs[0];

        // Format specifically for the ESP32
        return {
            leaveHouseAt: itinerary.start, // When to start walking
            line: vehicleLeg.route?.shortName || vehicleLeg.mode, // "M2" or "WALK"
            vehicleLeavesAt: vehicleLeg.start?.estimated?.time || itinerary.start,
            isLive: vehicleLeg.realtimeState === 'UPDATED',
            durationMinutes: Math.round(itinerary.duration / 60),
        };
    } catch (error) {
        console.error('Failed to fetch travel plan:', error.message);
        throw new ApiError(502, 'Failed to retrieve transit data');
    }
}

module.exports = { getTravelPlan };