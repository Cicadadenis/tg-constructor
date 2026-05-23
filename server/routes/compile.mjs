import express from "express";

import { buildBot } from "../../services/compiler/index.mjs";
import {
  compileRateLimit,
  validateCompileExecutionGraph,
} from "../middleware/compileMiddleware.mjs";

const router = express.Router();

router.post(
  "/compile",
  compileRateLimit,
  validateCompileExecutionGraph,
  async (req, res) => {
    try {
      const prepared = req.preparedExecutionGraph;
      const result = await buildBot(req.body, { prepared });

      res.json({
        ...result,
        execution: prepared.execution,
        compatibilityWarnings: prepared.compatibilityWarnings,
        migration: prepared.migration,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },
);

export default router;
