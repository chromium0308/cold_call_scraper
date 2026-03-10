require('dotenv').config();
const { Client } = require('@googlemaps/google-maps-services-js');
const axios = require('axios');

const client = new Client({});

const TYPES = [
  'restaurant', 'cafe', 'bar', 'hair_care', 'car_repair', 'gym', 
  'bakery', 'butcher', 'florist', 'car_wash', 'laundry', 'jewelry_store',
  'shoe_store', 'clothing_store', 'furniture_store', 'hardware_store',
  'plumber', 'electrician', 'painter', 'locksmith', 'pet_store', 'bookstore'
];

function hasNoWebsite(details) {
  const url = details.websiteUri ?? details.website;
  return url == null || (typeof url === 'string' && !url.trim());
}

async function getBusinessesWithPagination(location, radius = 15000) {
  const [lat, lng] = location.split(',').map(Number);
  let allResults = [];
  const seen = new Set();

  for (const type of TYPES) {
    try {
      let pageToken = null;
      let pageCount = 0;
      const maxPages = 3;

      do {
        const params = {
          location: `${lat},${lng}`,
          radius,
          type,
          key: process.env.GOOGLE_API_KEY
        };
        
        if (pageToken) {
          params.pagetoken = pageToken;
        }

        const response = await client.placesNearby({ params });
        const results = response.data.results;

        for (const place of results) {
          if (!seen.has(place.place_id)) {
            seen.add(place.place_id);
            allResults.push(place);
          }
        }

        pageToken = response.data.next_page_token;
        pageCount++;
        
        if (pageToken) {
          await new Promise(r => setTimeout(r, 2000));
        }
      } while (pageToken && pageCount < maxPages);

    } catch (err) {
      console.error(`Error fetching ${type}:`, err.message);
    }
  }

  return allResults;
}

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
    formatted_phone_number: p.nationalPhoneNumber ?? null
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
  console.log('Using pagination and multiple business types to find more businesses.\n');

  const businesses = await getBusinessesWithPagination(location);
  console.log(`Found ${businesses.length} unique businesses, checking for websites...\n`);

  const withoutWebsite = [];

  for (let i = 0; i < businesses.length; i++) {
    const business = businesses[i];
    try {
      const details = await getPlaceDetailsNew(business.place_id);
      
      if (hasNoWebsite(details)) {
        withoutWebsite.push({
          name: details.name || business.name,
          address: details.formatted_address || business.vicinity || 'N/A',
          phone: details.formatted_phone_number || 'N/A'
        });
        console.log(`[${i + 1}/${businesses.length}] FOUND: ${details.name}`);
      } else {
        console.log(`[${i + 1}/${businesses.length}] Has website: ${details.name}`);
      }
      
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.log(`[${i + 1}/${businesses.length}] Error: ${business.name}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`BUSINESSES WITHOUT WEBSITE (${withoutWebsite.length})`);
  console.log('='.repeat(60));
  
  withoutWebsite.forEach((b, i) => {
    console.log(`${i + 1}. ${b.name}`);
    console.log(`   Address: ${b.address}`);
    console.log(`   Phone: ${b.phone}`);
    console.log();
  });

  console.log(`Total: ${withoutWebsite.length} businesses without websites out of ${businesses.length} checked`);
}

main().catch(console.error);
