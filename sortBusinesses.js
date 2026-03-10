require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');
const axios = require('axios');

// Finds and lists only businesses that do NOT have a website (for lead gen, outreach, etc.)
// Uses Places API (New) for details so website data is reliable; legacy API often omits it.
const client = new Client({});

function hasNoWebsite(details) {
  const url = details.websiteUri ?? details.website;
  return url == null || (typeof url === 'string' && !url.trim());
}

async function getBusinesses(location, radius = 15000) {
  const [lat, lng] = location.split(',').map(Number);
  
  const types = ['restaurant', 'cafe', 'bar', 'hair_care', 'car_repair', 'gym', 'bakery', 'butcher', 'florist', 'car_wash', 'laundry', 'jewelry_store', 'shoe_store', 'clothing_store', 'furniture_store', 'electronics_store', 'hardware_store'];

  let allResults = [];
  
  for (const type of types) {
    try {
      const response = await client.placesNearby({
        params: {
          location: `${lat},${lng}`,
          radius,
          type,
          key: process.env.GOOGLE_API_KEY
        }
      });
      allResults = [...allResults, ...response.data.results];
    } catch (err) {
      // skip errors
    }
  }

  const unique = new Map();
  for (const b of allResults) {
    if (!unique.has(b.place_id)) {
      unique.set(b.place_id, b);
    }
  }
  
  return Array.from(unique.values());
}

/** Fetch place details from Places API (New) for reliable website field. */
async function getPlaceDetailsNew(placeId) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const response = await axios.get(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'displayName,formattedAddress,websiteUri,nationalPhoneNumber'
    }
  });
  const p = response.data;
  return {
    name: p.displayName?.text ?? p.displayName ?? null,
    formatted_address: p.formattedAddress ?? null,
    websiteUri: p.websiteUri ?? null,
    formatted_phone_number: p.nationalPhoneNumber ?? null,
    email: null
  };
}

async function main() {
  if (!process.env.GOOGLE_API_KEY) {
    console.error('Please set GOOGLE_API_KEY environment variable');
    process.exit(1);
  }

  const location = process.argv[2];
  if (!location) {
    console.error('Usage: node sortBusinesses.js "40.7128,-74.0060"');
    process.exit(1);
  }

  console.log(`\nSearching businesses within 15km of ${location}...`);
  console.log('Filtering for businesses that do NOT have a website.\n');

  const businesses = await getBusinesses(location);
  console.log(`Found ${businesses.length} businesses, checking which have no website...\n`);

  const withoutWebsite = [];

  for (const business of businesses) {
    try {
      const details = await getPlaceDetailsNew(business.place_id);
      
      if (hasNoWebsite(details)) {
        withoutWebsite.push({
          name: details.name || business.name,
          address: details.formatted_address || business.vicinity || 'N/A',
          phone: details.formatted_phone_number || 'N/A'
        });
      }
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      // Skip places we couldn't verify
    }
  }

  console.log('='.repeat(60));
  console.log(`BUSINESSES WITHOUT WEBSITE (${withoutWebsite.length})`);
  console.log('='.repeat(60));

  withoutWebsite.forEach((b, i) => {
    console.log(`${i + 1}. ${b.name}`);
    console.log(`   Address: ${b.address}`);
    console.log(`   Phone: ${b.phone}`);
    console.log();
  });

  console.log(`Total: ${withoutWebsite.length} businesses without websites`);
}

main().catch(console.error);
