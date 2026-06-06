import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { GallineroService } from './application/GallineroService.js';
import { LocationService } from './application/LocationService.js';
import { createApiRouter } from './adapters/in/http/routes.js';
import { FileLocationStore } from './adapters/out/location/FileLocationStore.js';
import { WokwiRfc2217SimulatorAdapter } from './adapters/out/simulator/WokwiRfc2217SimulatorAdapter.js';
import { WorldTimeApiAdapter } from './adapters/out/time/WorldTimeApiAdapter.js';
import { OpenMeteoWeatherAdapter } from './adapters/out/weather/OpenMeteoWeatherAdapter.js';
import { createLocationFromEnv } from './domain/locations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.API_PORT || 3000);
const wokwiPort = Number(process.env.WOKWI_RFC2217_PORT || 4000);
const weatherPollMs = Number(process.env.WEATHER_POLL_MS || 10 * 60 * 1000);
const defaultLocation = createLocationFromEnv(process.env);

const service = new GallineroService({
  wokwiSimulator: new WokwiRfc2217SimulatorAdapter({ port: wokwiPort }),
  weatherProvider: new OpenMeteoWeatherAdapter({
    latitude: defaultLocation.latitude,
    longitude: defaultLocation.longitude,
    timezone: defaultLocation.timezone,
    locationLabel: defaultLocation.label,
    pollMs: weatherPollMs
  }),
  weatherAutomation: {
    enabled: process.env.WEATHER_AUTOMATION_ENABLED !== 'false',
    lowTemp: Number(process.env.WEATHER_LOW_TEMP || 10),
    highTemp: Number(process.env.WEATHER_HIGH_TEMP || 26)
  },
  timeProvider: new WorldTimeApiAdapter({
    timezone: defaultLocation.timezone
  }),
  locationService: new LocationService({
    defaultLocation,
    locationStore: new FileLocationStore({
      filePath: path.resolve(__dirname, '../../../data/locations.json')
    })
  }),
  lightAutomation: {
    enabled: process.env.LIGHT_AUTOMATION_ENABLED !== 'false',
    onHour: Number(process.env.LIGHT_ON_HOUR || 6),
    offHour: Number(process.env.LIGHT_OFF_HOUR || 20)
  }
});

app.use(cors());
app.use(express.json());
app.use('/api', createApiRouter(service));

const frontDist = path.resolve(__dirname, '../../front/dist');
app.use(express.static(frontDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontDist, 'index.html'), error => {
    if (error) {
      res.status(200).send('Gallinero API activo. En desarrollo abre el front en http://localhost:5173');
    }
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

service.start();

app.listen(port, () => {
  console.log(`Gallinero API: http://localhost:${port}`);
  console.log(`Wokwi RFC2217 esperado en localhost:${wokwiPort}`);
});
