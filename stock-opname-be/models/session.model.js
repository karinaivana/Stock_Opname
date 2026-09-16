const postgres = require("../helper/databases/postgres");
const { setAuditUser } = require("../helper/databases/audit");
const { httpError, rethrow, safeRollback } = require("../helper/utils/error");
const { trimString } = require("../helper/utils/normalize");
const {
  ACTIVE_STATUSES,
  UUID_PATTERN,
} = require("../constants/sessions");

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertUuid(value, label = "id") {
  const id = trimString(value);
  if (!id) throw httpError(`${label} is required`, 400);
  if (!UUID_PATTERN.test(id)) throw httpError(`${label} is invalid`, 400);
  return id;
}

function requireWarehouseAccess(user) {
  const warehouseId = trimString(user?.warehouse_id);
  if (!warehouseId) {
    throw httpError("User is not assigned to a warehouse", 403);
  }
  return warehouseId;
}

function parseCountTypesJson(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toPublicSession(row, extras = {}) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    warehouse: {
      id: row.warehouse_id,
      code: row.warehouse_code,
      name: row.warehouse_name,
    },
    created_by: row.created_by,
    submitted_by: row.submitted_by || null,
    approved_by: row.approved_by || null,
    snapshot_at: row.snapshot_at,
    submitted_at: row.submitted_at || null,
    approved_at: row.approved_at || null,
    rejected_at: row.rejected_at || null,
    completed_at: row.completed_at || null,
    reject_reason: row.reject_reason || null,
    item_count:
      row.item_count != null ? Number(row.item_count) : extras.item_count || 0,
    ...extras,
  };
}

async function getWarehouseForUser(warehouseId, client) {
  const rows = await postgres.execute(
    `
      SELECT id, code, name, is_active
      FROM warehouses
      WHERE id = $1
      LIMIT 1
    `,
    [warehouseId],
    client
  );
  return rows[0] || null;
}

async function findActiveSession(warehouseId, client) {
  const rows = await postgres.execute(
    `
      SELECT id, code, status
      FROM audit_sessions
      WHERE warehouse_id = $1
        AND status = ANY($2::text[])
      LIMIT 1
    `,
    [warehouseId, ACTIVE_STATUSES],
    client
  );
  return rows[0] || null;
}

async function generateSessionCode(warehouseCode, client) {
  const loc = String(warehouseCode || "WH")
    .replace(/^WH-/i, "")
    .toUpperCase();
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const base = `SOP-${loc}-${yymm}`;

  const rows = await postgres.execute(
    `
      SELECT code
      FROM audit_sessions
      WHERE code = $1 OR code LIKE $2
      ORDER BY code DESC
    `,
    [base, `${base}-%`],
    client
  );

  if (rows.length === 0) return base;

  let maxSuffix = 1;
  for (const row of rows) {
    if (row.code === base) {
      maxSuffix = Math.max(maxSuffix, 1);
      continue;
    }
    const match = String(row.code).match(/-(\d+)$/);
    if (match) {
      maxSuffix = Math.max(maxSuffix, Number(match[1]));
    }
  }

  return rows.some((row) => row.code === base)
    ? `${base}-${maxSuffix + 1}`
    : base;
}

async function loadSessionRow(sessionId, client) {
  const rows = await postgres.execute(
    `
      SELECT
        s.id,
        s.code,
        s.status,
        s.warehouse_id,
        w.code AS warehouse_code,
        w.name AS warehouse_name,
        s.created_by,
        s.submitted_by,
        s.approved_by,
        s.snapshot_at,
        s.submitted_at,
        s.approved_at,
        s.rejected_at,
        s.completed_at,
        s.reject_reason,
        (
          SELECT COUNT(*)::int
          FROM session_items si
          WHERE si.session_id = s.id
        ) AS item_count
      FROM audit_sessions s
      JOIN warehouses w ON w.id = s.warehouse_id
      WHERE s.id = $1
      LIMIT 1
    `,
    [sessionId],
    client
  );
  return rows[0] || null;
}

async function loadSessionItems(sessionId, client) {
  const rows = await postgres.execute(
    `
      SELECT
        si.product_id,
        p.sku,
        p.name,
        p.base_uom,
        si.expected_qty,
        si.counted_qty,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'uom', ct.uom,
                'factor_to_base', ct.factor_to_base,
                'is_base', ct.is_base,
                'sort_order', ct.sort_order
              )
              ORDER BY ct.is_base ASC, ct.sort_order ASC, ct.uom ASC
            )
            FROM session_item_count_types ct
            WHERE ct.session_id = si.session_id
              AND ct.product_id = si.product_id
          ),
          '[]'::json
        ) AS count_types,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'uom', c.uom,
                'qty', c.qty
              )
              ORDER BY c.uom ASC
            )
            FROM session_item_counts c
            WHERE c.session_id = si.session_id
              AND c.product_id = si.product_id
          ),
          '[]'::json
        ) AS counts
      FROM session_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.session_id = $1
      ORDER BY p.sku ASC
    `,
    [sessionId],
    client
  );

  return rows.map((row) => {
    const expected = toNumber(row.expected_qty);
    const counted = row.counted_qty == null ? null : toNumber(row.counted_qty);
    const variance =
      counted == null || expected == null ? null : counted - expected;

    return {
      product_id: row.product_id,
      sku: row.sku,
      name: row.name,
      base_uom: row.base_uom,
      expected_qty: expected,
      counted_qty: counted,
      variance,
      count_types: parseCountTypesJson(row.count_types).map((item) => ({
        uom: item.uom,
        factor_to_base: toNumber(item.factor_to_base) ?? 0,
        is_base: Boolean(item.is_base),
        sort_order: Number(item.sort_order) || 0,
      })),
      counts: parseCountTypesJson(row.counts).map((item) => ({
        uom: item.uom,
        qty: toNumber(item.qty) ?? 0,
      })),
    };
  });
}

async function assertSessionAccess(user, sessionId, client) {
  const id = assertUuid(sessionId, "Session id");
  const warehouseId = requireWarehouseAccess(user);
  const session = await loadSessionRow(id, client);

  if (!session) {
    throw httpError("Session not found", 404);
  }
  if (session.warehouse_id !== warehouseId) {
    throw httpError("Forbidden for this warehouse session", 403);
  }

  return session;
}

async function list(user) {
  try {
    const warehouseId = requireWarehouseAccess(user);

    const rows = await postgres.execute(
      `
        SELECT
          s.id,
          s.code,
          s.status,
          s.warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          s.created_by,
          s.submitted_by,
          s.approved_by,
          s.snapshot_at,
          s.submitted_at,
          s.approved_at,
          s.rejected_at,
          s.completed_at,
          s.reject_reason,
          COUNT(si.product_id)::int AS item_count
        FROM audit_sessions s
        JOIN warehouses w ON w.id = s.warehouse_id
        LEFT JOIN session_items si ON si.session_id = s.id
        WHERE s.warehouse_id = $1
        GROUP BY s.id, w.code, w.name
        ORDER BY s.snapshot_at DESC, s.created_at DESC
      `,
      [warehouseId]
    );

    const active = rows.find((row) => ACTIVE_STATUSES.includes(row.status));

    return {
      warehouse: rows[0]
        ? {
            id: rows[0].warehouse_id,
            code: rows[0].warehouse_code,
            name: rows[0].warehouse_name,
          }
        : (await getWarehouseForUser(warehouseId)) || { id: warehouseId },
      has_active_session: Boolean(active),
      active_session: active
        ? {
            id: active.id,
            code: active.code,
            status: active.status,
          }
        : null,
      items: rows.map((row) => toPublicSession(row)),
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve sessions");
  }
}

async function getCandidates(user) {
  try {
    const warehouseId = requireWarehouseAccess(user);
    const warehouse = await getWarehouseForUser(warehouseId);
    if (!warehouse) {
      throw httpError("Warehouse not found", 404);
    }
    if (!warehouse.is_active) {
      throw httpError("Cannot start a session for an inactive warehouse", 400);
    }

    const active = await findActiveSession(warehouseId);
    const rows = await postgres.execute(
      `
        SELECT
          p.id AS product_id,
          p.sku,
          p.name,
          p.base_uom,
          ib.on_hand_qty,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'uom', pct.uom,
                  'factor_to_base', pct.factor_to_base,
                  'is_base', pct.is_base,
                  'sort_order', pct.sort_order
                )
                ORDER BY pct.is_base ASC, pct.sort_order ASC, pct.uom ASC
              )
              FROM product_count_types pct
              WHERE pct.product_id = p.id
            ),
            '[]'::json
          ) AS count_types
        FROM inventory_balances ib
        JOIN products p ON p.id = ib.product_id
        WHERE ib.warehouse_id = $1
          AND p.is_active = true
        ORDER BY p.sku ASC
      `,
      [warehouseId]
    );

    return {
      warehouse: {
        id: warehouse.id,
        code: warehouse.code,
        name: warehouse.name,
      },
      has_active_session: Boolean(active),
      active_session: active
        ? {
            id: active.id,
            code: active.code,
            status: active.status,
          }
        : null,
      items: rows.map((row) => ({
        product_id: row.product_id,
        sku: row.sku,
        name: row.name,
        base_uom: row.base_uom,
        on_hand_qty: toNumber(row.on_hand_qty),
        count_types: parseCountTypesJson(row.count_types).map((item) => ({
          uom: item.uom,
          factor_to_base: toNumber(item.factor_to_base) ?? 0,
          is_base: Boolean(item.is_base),
          sort_order: Number(item.sort_order) || 0,
        })),
      })),
    };
  } catch (error) {
    rethrow(error, "Failed to retrieve snapshot candidates");
  }
}

async function create(user, body = {}) {
  const warehouseId = requireWarehouseAccess(user);
  const rawProductIds = body.productIds ?? body.product_ids;
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const warehouse = await getWarehouseForUser(warehouseId, connection);
    if (!warehouse) {
      throw httpError("Warehouse not found", 404);
    }
    if (!warehouse.is_active) {
      throw httpError("Cannot start a session for an inactive warehouse", 400);
    }

    const active = await findActiveSession(warehouseId, connection);
    if (active) {
      throw httpError(
        `Warehouse already has an active session (${active.code}, ${active.status})`,
        409
      );
    }

    let productIds;
    if (Array.isArray(rawProductIds) && rawProductIds.length > 0) {
      productIds = [
        ...new Set(rawProductIds.map((id) => assertUuid(id, "Product id"))),
      ];
    } else {
      const allRows = await postgres.execute(
        `
          SELECT ib.product_id
          FROM inventory_balances ib
          JOIN products p ON p.id = ib.product_id
          WHERE ib.warehouse_id = $1
            AND p.is_active = true
          ORDER BY p.sku ASC
        `,
        [warehouseId],
        connection
      );
      productIds = allRows.map((row) => row.product_id);
    }

    if (productIds.length === 0) {
      throw httpError(
        "At least one SKU with opening stock is required to start a session",
        400
      );
    }

    const balanceRows = await postgres.execute(
      `
        SELECT
          ib.product_id,
          ib.on_hand_qty,
          p.sku,
          p.is_active
        FROM inventory_balances ib
        JOIN products p ON p.id = ib.product_id
        WHERE ib.warehouse_id = $1
          AND ib.product_id = ANY($2::uuid[])
      `,
      [warehouseId, productIds],
      connection
    );

    if (balanceRows.length !== productIds.length) {
      throw httpError(
        "One or more selected SKUs have no opening stock in this warehouse",
        400
      );
    }

    for (const row of balanceRows) {
      if (!row.is_active) {
        throw httpError(`Cannot include inactive SKU ${row.sku}`, 400);
      }
    }

    const code = await generateSessionCode(warehouse.code, connection);
    const sessionRows = await postgres.execute(
      `
        INSERT INTO audit_sessions (
          code, warehouse_id, status, created_by, snapshot_at, updated_by
        )
        VALUES ($1, $2, 'COUNTING', $3, now(), $3)
        RETURNING id
      `,
      [code, warehouseId, user.name],
      connection
    );
    const sessionId = sessionRows[0].id;

    for (const productId of productIds) {
      const balance = balanceRows.find((row) => row.product_id === productId);
      await postgres.execute(
        `
          INSERT INTO session_items (session_id, product_id, expected_qty)
          VALUES ($1, $2, $3)
        `,
        [sessionId, productId, balance.on_hand_qty],
        connection
      );

      await postgres.execute(
        `
          INSERT INTO session_item_count_types (
            session_id, product_id, uom, factor_to_base, is_base, sort_order
          )
          SELECT $1, pct.product_id, pct.uom, pct.factor_to_base, pct.is_base, pct.sort_order
          FROM product_count_types pct
          WHERE pct.product_id = $2
        `,
        [sessionId, productId],
        connection
      );
    }

    const session = await loadSessionRow(sessionId, connection);
    const items = await loadSessionItems(sessionId, connection);
    await connection.query("COMMIT");

    return toPublicSession(session, { items });
  } catch (error) {
    await safeRollback(connection);
    if (error?.constraint === "uq_audit_sessions_one_active_per_warehouse") {
      throw httpError(
        "Warehouse already has an active session",
        409
      );
    }
    rethrow(error, "Failed to create session");
  } finally {
    connection.release();
  }
}

async function getById(user, id) {
  try {
    const session = await assertSessionAccess(user, id);
    const items = await loadSessionItems(session.id);
    return toPublicSession(session, { items });
  } catch (error) {
    rethrow(error, "Failed to retrieve session");
  }
}

function normalizeSubmitItems(rawItems, sessionItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw httpError("Count items are required", 400);
  }

  const byProduct = new Map(
    sessionItems.map((item) => [item.product_id, item])
  );
  const seen = new Set();
  const normalized = [];

  for (const raw of rawItems) {
    const productId = assertUuid(raw.productId ?? raw.product_id, "Product id");
    if (seen.has(productId)) {
      throw httpError("Duplicate product in count payload", 400);
    }
    seen.add(productId);

    const sessionItem = byProduct.get(productId);
    if (!sessionItem) {
      throw httpError(`Product ${productId} is not part of this session`, 400);
    }

    const allowedUoms = new Map(
      sessionItem.count_types.map((ct) => [ct.uom, ct])
    );
    const rawCounts = raw.counts ?? raw.count_inputs ?? [];
    if (!Array.isArray(rawCounts) || rawCounts.length === 0) {
      throw httpError(`Counts are required for SKU ${sessionItem.sku}`, 400);
    }

    const counts = [];
    const countUoms = new Set();
    for (const entry of rawCounts) {
      const uom = trimString(entry?.uom).toLowerCase();
      const qty = toNumber(entry?.qty ?? entry?.quantity);
      if (!uom) throw httpError("Count UOM is required", 400);
      if (!allowedUoms.has(uom)) {
        throw httpError(
          `UOM ${uom} is not in the snapshot for SKU ${sessionItem.sku}`,
          400
        );
      }
      // Empty / omitted qty for a UOM is treated as 0 (staff need not fill every unit).
      const normalizedQty = qty === null ? 0 : qty;
      if (normalizedQty < 0) {
        throw httpError("Count qty cannot be negative", 400);
      }
      if (countUoms.has(uom)) {
        throw httpError(`Duplicate UOM ${uom} for SKU ${sessionItem.sku}`, 400);
      }
      countUoms.add(uom);
      counts.push({ uom, qty: Math.round(normalizedQty * 1000) / 1000 });
    }

    // Snapshot UOMs that were not sent default to 0.
    for (const uom of allowedUoms.keys()) {
      if (!countUoms.has(uom)) {
        counts.push({ uom, qty: 0 });
        countUoms.add(uom);
      }
    }

    const hasAnyEntered = rawCounts.some((entry) => {
      const qty = toNumber(entry?.qty ?? entry?.quantity);
      return qty !== null;
    });
    if (!hasAnyEntered) {
      throw httpError(
        `At least one count qty is required for SKU ${sessionItem.sku}`,
        400
      );
    }

    let countedQty = 0;
    for (const count of counts) {
      const factor = allowedUoms.get(count.uom).factor_to_base;
      countedQty += count.qty * factor;
    }
    countedQty = Math.round(countedQty * 1000) / 1000;

    normalized.push({ productId, counts, countedQty });
  }

  if (normalized.length !== sessionItems.length) {
    throw httpError(
      "All session SKUs must be included in a single submit batch",
      400
    );
  }

  return normalized;
}

async function submitCounts(user, id, body = {}) {
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const session = await assertSessionAccess(user, id, connection);
    if (session.status !== "COUNTING") {
      throw httpError(
        `Counts can only be submitted while status is COUNTING (current: ${session.status})`,
        409
      );
    }

    const items = await loadSessionItems(session.id, connection);
    const normalized = normalizeSubmitItems(body.items, items);

    for (const item of normalized) {
      await postgres.execute(
        `
          DELETE FROM session_item_counts
          WHERE session_id = $1 AND product_id = $2
        `,
        [session.id, item.productId],
        connection
      );

      for (const count of item.counts) {
        await postgres.execute(
          `
            INSERT INTO session_item_counts (session_id, product_id, uom, qty)
            VALUES ($1, $2, $3, $4)
          `,
          [session.id, item.productId, count.uom, count.qty],
          connection
        );
      }

      await postgres.execute(
        `
          UPDATE session_items
          SET counted_qty = $1
          WHERE session_id = $2 AND product_id = $3
        `,
        [item.countedQty, session.id, item.productId],
        connection
      );
    }

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'SUBMITTED',
            submitted_by = $1,
            submitted_at = now()
        WHERE id = $2
      `,
      [user.name, session.id],
      connection
    );

    const updated = await loadSessionRow(session.id, connection);
    const updatedItems = await loadSessionItems(session.id, connection);
    await connection.query("COMMIT");

    // Submit only writes session tables — inventory_balances is untouched (BR-02).
    return toPublicSession(updated, { items: updatedItems });
  } catch (error) {
    await safeRollback(connection);
    rethrow(error, "Failed to submit counts");
  } finally {
    connection.release();
  }
}

async function getVariances(user, id) {
  try {
    const session = await assertSessionAccess(user, id);
    if (
      ![
        "SUBMITTED",
        "APPROVED",
        "RECONCILING",
        "COMPLETED",
        "REJECTED",
        "FAILED",
      ].includes(session.status)
    ) {
      throw httpError("Variances are available after staff submit", 409);
    }

    const items = await loadSessionItems(session.id);
    const sorted = [...items].sort((a, b) => {
      const va = Math.abs(a.variance ?? 0);
      const vb = Math.abs(b.variance ?? 0);
      return vb - va;
    });

    let matchCount = 0;
    let shortCount = 0;
    let overCount = 0;

    const enriched = sorted.map((item) => {
      const variance = item.variance;
      if (variance === 0) matchCount += 1;
      else if (variance != null && variance < 0) shortCount += 1;
      else if (variance != null && variance > 0) overCount += 1;

      const detailParts = (item.counts || []).map(
        (count) => `${toNumber(count.qty)} ${count.uom}`
      );
      const isCompound = (item.count_types || []).length > 1;

      return {
        ...item,
        detail_text:
          isCompound && detailParts.length > 0 ? detailParts.join(" + ") : null,
      };
    });

    return toPublicSession(session, {
      items: enriched,
      summary: {
        total_sku: enriched.length,
        match_count: matchCount,
        short_count: shortCount,
        over_count: overCount,
        variance_count: shortCount + overCount,
      },
    });
  } catch (error) {
    rethrow(error, "Failed to retrieve variances");
  }
}

async function approve(user, id) {
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const session = await assertSessionAccess(user, id, connection);

    if (session.status === "APPROVED" || session.status === "RECONCILING" || session.status === "COMPLETED") {
      const existingJob = await postgres.execute(
        `
          SELECT id, status, idempotency_key
          FROM reconciliation_jobs
          WHERE session_id = $1
          LIMIT 1
        `,
        [session.id],
        connection
      );
      await connection.query("COMMIT");
      return {
        session: toPublicSession(session),
        job: existingJob[0]
          ? {
              id: existingJob[0].id,
              status: existingJob[0].status,
              idempotency_key: existingJob[0].idempotency_key,
            }
          : null,
        already_approved: true,
      };
    }

    if (session.status !== "SUBMITTED") {
      throw httpError(
        `Only SUBMITTED sessions can be approved (current: ${session.status})`,
        409
      );
    }

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'APPROVED',
            approved_by = $1,
            approved_at = now()
        WHERE id = $2
      `,
      [user.name, session.id],
      connection
    );

    const idempotencyKey = `reconcile:${session.id}`;
    let jobRows = await postgres.execute(
      `
        INSERT INTO reconciliation_jobs (session_id, status, idempotency_key)
        VALUES ($1, 'PENDING', $2)
        ON CONFLICT (session_id) DO NOTHING
        RETURNING id, status, idempotency_key
      `,
      [session.id, idempotencyKey],
      connection
    );

    if (jobRows.length === 0) {
      jobRows = await postgres.execute(
        `
          SELECT id, status, idempotency_key
          FROM reconciliation_jobs
          WHERE session_id = $1
          LIMIT 1
        `,
        [session.id],
        connection
      );
    }

    const updated = await loadSessionRow(session.id, connection);
    await connection.query("COMMIT");

    return {
      session: toPublicSession(updated),
      job: jobRows[0]
        ? {
            id: jobRows[0].id,
            status: jobRows[0].status,
            idempotency_key: jobRows[0].idempotency_key,
          }
        : null,
      already_approved: false,
    };
  } catch (error) {
    await safeRollback(connection);
    rethrow(error, "Failed to approve session");
  } finally {
    connection.release();
  }
}

async function reject(user, id, body = {}) {
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    await setAuditUser(connection, user);

    const session = await assertSessionAccess(user, id, connection);
    if (session.status !== "SUBMITTED") {
      throw httpError(
        `Only SUBMITTED sessions can be rejected (current: ${session.status})`,
        409
      );
    }

    const reason = trimString(body.reason ?? body.reject_reason) || null;

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'REJECTED',
            reject_reason = $1,
            rejected_at = now(),
            approved_by = NULL,
            approved_at = NULL
        WHERE id = $2
      `,
      [reason, session.id],
      connection
    );

    const updated = await loadSessionRow(session.id, connection);
    const items = await loadSessionItems(session.id, connection);
    await connection.query("COMMIT");

    return toPublicSession(updated, { items });
  } catch (error) {
    await safeRollback(connection);
    rethrow(error, "Failed to reject session");
  } finally {
    connection.release();
  }
}

module.exports = {
  list,
  getCandidates,
  create,
  getById,
  submitCounts,
  getVariances,
  approve,
  reject,
};
