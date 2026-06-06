import express from 'express';

export function createApiRouter(service) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    const state = service.getState();
    res.json({
      ok: true,
      source: state.source,
      connected: state.connected,
      updatedAt: state.updatedAt
    });
  });

  router.get('/state', (req, res) => {
    res.json(service.getState());
  });

  router.get('/weather', (req, res) => {
    res.json(service.getWeather());
  });

  router.get('/time', (req, res) => {
    res.json(service.getTime());
  });

  router.get('/locations', (req, res) => {
    res.json(service.getLocations());
  });

  router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = state => res.write(`data: ${JSON.stringify(state)}\n\n`);
    send(service.getState());
    service.on('state', send);

    req.on('close', () => {
      service.off('state', send);
    });
  });

  router.post('/controls/:target', async (req, res, next) => {
    try {
      const result = await service.control(req.params.target, req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/resources', async (req, res, next) => {
    try {
      const result = await service.control('resources', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/weather/automation', async (req, res, next) => {
    try {
      const result = await service.control('weather-automation', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/weather/refresh', async (req, res, next) => {
    try {
      const result = await service.control('weather-refresh', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/light/automation', async (req, res, next) => {
    try {
      const result = await service.control('light-automation', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/time/refresh', async (req, res, next) => {
    try {
      const result = await service.control('time-refresh', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/active', async (req, res, next) => {
    try {
      const result = await service.control('location-active', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/manual', async (req, res, next) => {
    try {
      const result = await service.control('location-manual', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/browser', async (req, res, next) => {
    try {
      const result = await service.control('location-browser', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/denied', async (req, res, next) => {
    try {
      const result = await service.control('location-denied', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/locations/reset', async (req, res, next) => {
    try {
      const result = await service.control('location-reset', req.body || {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
