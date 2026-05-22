import express from "express";

import { buildBot } from "../../services/compiler/index.mjs";

const router = express.Router();

router.post("/compile", async (req, res) => {
  try {
    const result = await buildBot(req.body);

    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
