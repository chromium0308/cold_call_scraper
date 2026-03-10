# Website-less Business Sorter

Finds businesses within 15km of a location and identifies which ones don't have a website.

## Setup

1. Get a Google Cloud API key with **Places API** enabled:
   - Go to https://console.cloud.google.com/
   - Create a project and enable Places API

2. Copy `.env.example` to `.env` and add your API key:
   ```
   GOOGLE_API_KEY=your_actual_key_here
   ```

3. Install dependencies:
   ```
   npm install
   ```

## Usage

Run with coordinates (latitude,longitude):

```bash
# New York City
npm start "40.7128,-74.0060"

# San Francisco
npm start "37.7749,-122.4194"

# London
npm start "51.5074,-0.1278"

# Your custom location
npm start "your_lat,your_lng"
```

## Output

The script will show:
- List of businesses WITHOUT a website
- List of businesses WITH a website
- Summary count
