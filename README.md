# WanderGuide Global v12

1. Run `npm install`
2. Copy `.env.local.example` to `.env.local` and add the YouTube API key.
3. Run `npm run import:world` to generate the global destination catalogue.
4. Run `npm run dev`.
5. Before deployment run `npm run build`.

Features: Country → State/Province → destinations, regional weather ranking, destination-specific attractions, last 7 + next 7 days weather, and 10 latest embeddable YouTube travel videos played inside the app.


## v12.1 fixes
- Configures the `@/*` TypeScript alias so `@/lib/data` resolves correctly.
- Includes `public/data/destinations.json` for client-side loading.
- `npm run import:world` now updates both the server-side and public destination catalogues.


## v13
State/province names now come from GeoNames admin1CodesASCII. Run `npm run import:world` again after upgrading. Adds professional responsive UI, loading overlay, weather-aware rain/snow/storm/fog hero effects, search, hover transitions, and improved destination ranking UX.

## v14
- Compact 5-column video evidence grid on desktop (10 videos = 2 rows).
- Latest 10 and Most Viewed 10 tabs.
- One YouTube search supplies candidates for both lists to reduce quota usage.
- Best day, next-7-day rainfall, rainy-day count, comfort score, fresh-video count and rain trend.
- Expanded visual dashboard, progress graphics, weather effects, loaders and in-app video player.
- No database required; destination catalogue is static JSON, API responses are cached in server memory, and weather/video data are live APIs.
