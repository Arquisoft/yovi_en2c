// ─────────────────────────────────────────────────────────────────────────────
// gateway-service.js — Pie Rule endpoint
//
// Add the constant and the route below.
//
// CONSTANT: add after the GAME_NEW_URL / GAME_STATUS_URL block
// ─────────────────────────────────────────────────────────────────────────────

const GAME_SWAP_URL = `${GAMEY_BASE_URL}/v1/game/swap`;

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE: add in the "── Game endpoints ──" section, after /game/status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /game/swap
 * Applies the Pie Rule swap to the current YEN state.
 * Proxies to POST /v1/game/swap on the Rust game engine.
 *
 * Body: { yen: <YEN object> }
 * Response: { ok: true, yen: <swapped YEN object> }
 *
 * Errors:
 *   400 — Missing YEN in request body
 *   400 — Swap not allowed at this turn (forwarded from game engine)
 *   502 — Game server unreachable
 */
app.post("/game/swap", async (req, res) => {
  const { yen } = req.body;

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });

  try {
    const response = await axios.post(GAME_SWAP_URL, { yen }); // NOSONAR
    const payload  = response.data || {};

    return res.status(200).json({
      ok:            true,
      yen:           payload.yen ?? payload,
      finished:      payload.finished === true,
      winner:        payload.winner ?? null,
      winning_edges: payload.winning_edges ?? [],
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});
