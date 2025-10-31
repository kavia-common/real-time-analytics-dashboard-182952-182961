const healthService = require('../services/health');

class HealthController {
  // PUBLIC_INTERFACE
  check(req, res) {
    /**
     * Health endpoint handler.
     * Purpose: returns service health status regardless of MongoDB connectivity.
     * Params: Express Request, Response
     * Returns: 200 JSON { status, message, timestamp, environment, mongo, socket, process }
     */
    const healthStatus = healthService.getStatus();
    return res.status(200).json(healthStatus);
  }
}

module.exports = new HealthController();
