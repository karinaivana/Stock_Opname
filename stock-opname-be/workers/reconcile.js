const postgres = require("../helper/databases/postgres");
const { setAuditUser } = require("../helper/databases/audit");
const { safeRollback } = require("../helper/utils/error");

const POLL_INTERVAL_MS = Number(process.env.RECONCILE_POLL_MS || 2000);
const STALE_PROCESSING_MS = Number(
  process.env.RECONCILE_STALE_MS || 5 * 60 * 1000
);
const MAX_ATTEMPTS = Number(process.env.RECONCILE_MAX_ATTEMPTS || 3);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveAuditUserName(preferredName, connection) {
  const preferred = String(preferredName || "").trim();
  if (preferred) {
    const rows = await postgres.execute(
      `
        SELECT full_name
        FROM users
        WHERE full_name = $1
        LIMIT 1
      `,
      [preferred],
      connection
    );
    if (rows[0]?.full_name) return rows[0].full_name;
  }

  const fallback = await postgres.execute(
    `
      SELECT full_name
      FROM users
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [],
    connection
  );
  if (!fallback[0]?.full_name) {
    throw new Error("No users found to set audit fields for reconcile worker");
  }
  return fallback[0].full_name;
}

async function reclaimStaleProcessing() {
  const staleSeconds = Math.max(1, Math.floor(STALE_PROCESSING_MS / 1000));
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");

    const staleJobs = await postgres.execute(
      `
        SELECT id, session_id
        FROM reconciliation_jobs
        WHERE status = 'PROCESSING'
          AND started_at IS NOT NULL
          AND started_at < now() - ($1::text || ' seconds')::interval
        FOR UPDATE SKIP LOCKED
      `,
      [String(staleSeconds)],
      connection
    );

    if (staleJobs.length === 0) {
      await connection.query("COMMIT");
      return 0;
    }

    for (const job of staleJobs) {
      const sessionRows = await postgres.execute(
        `
          SELECT status, approved_by
          FROM audit_sessions
          WHERE id = $1
          LIMIT 1
        `,
        [job.session_id],
        connection
      );
      const session = sessionRows[0];
      const auditName = await resolveAuditUserName(
        session?.approved_by,
        connection
      );
      await setAuditUser(connection, { name: auditName });

      if (session?.status === "COMPLETED") {
        await postgres.execute(
          `
            UPDATE reconciliation_jobs
            SET status = 'DONE',
                finished_at = COALESCE(finished_at, now()),
                last_error = NULL
            WHERE id = $1
          `,
          [job.id],
          connection
        );
        continue;
      }

      await postgres.execute(
        `
          UPDATE reconciliation_jobs
          SET status = 'PENDING',
              started_at = NULL,
              finished_at = NULL,
              last_error = 'Reclaimed stale PROCESSING job'
          WHERE id = $1
        `,
        [job.id],
        connection
      );

      if (session?.status === "RECONCILING" || session?.status === "FAILED") {
        await postgres.execute(
          `
            UPDATE audit_sessions
            SET status = 'APPROVED',
                completed_at = NULL
            WHERE id = $1
          `,
          [job.session_id],
          connection
        );
      }
    }

    await connection.query("COMMIT");
    return staleJobs.length;
  } catch (error) {
    await safeRollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function requeueFailedJobs() {
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");

    const failedJobs = await postgres.execute(
      `
        SELECT id, session_id, attempts
        FROM reconciliation_jobs
        WHERE status = 'FAILED'
          AND attempts < $1
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
      `,
      [MAX_ATTEMPTS],
      connection
    );

    if (failedJobs.length === 0) {
      await connection.query("COMMIT");
      return 0;
    }

    for (const job of failedJobs) {
      const sessionRows = await postgres.execute(
        `
          SELECT status, approved_by
          FROM audit_sessions
          WHERE id = $1
          LIMIT 1
        `,
        [job.session_id],
        connection
      );
      const session = sessionRows[0];

      if (session?.status === "COMPLETED") {
        await setAuditUser(connection, {
          name: await resolveAuditUserName(session.approved_by, connection),
        });
        await postgres.execute(
          `
            UPDATE reconciliation_jobs
            SET status = 'DONE',
                finished_at = COALESCE(finished_at, now()),
                last_error = NULL
            WHERE id = $1
          `,
          [job.id],
          connection
        );
        continue;
      }

      await setAuditUser(connection, {
        name: await resolveAuditUserName(session?.approved_by, connection),
      });

      await postgres.execute(
        `
          UPDATE reconciliation_jobs
          SET status = 'PENDING',
              started_at = NULL,
              finished_at = NULL
          WHERE id = $1
        `,
        [job.id],
        connection
      );

      if (session?.status === "FAILED" || session?.status === "RECONCILING") {
        await postgres.execute(
          `
            UPDATE audit_sessions
            SET status = 'APPROVED',
                completed_at = NULL
            WHERE id = $1
          `,
          [job.session_id],
          connection
        );
      }
    }

    await connection.query("COMMIT");
    return failedJobs.length;
  } catch (error) {
    await safeRollback(connection);
    throw error;
  } finally {
    connection.release();
  }
}

async function markJobFailed(jobId, sessionId, approvedByName, error) {
  const message = String(error?.message || error || "Unknown worker error").slice(
    0,
    2000
  );
  const connection = await postgres.getConnection();

  try {
    await connection.query("BEGIN");
    const auditName = await resolveAuditUserName(approvedByName, connection);
    await setAuditUser(connection, { name: auditName });

    await postgres.execute(
      `
        UPDATE reconciliation_jobs
        SET status = 'FAILED',
            attempts = CASE
              WHEN status = 'PENDING' THEN attempts + 1
              ELSE attempts
            END,
            finished_at = now(),
            last_error = $2
        WHERE id = $1
      `,
      [jobId, message],
      connection
    );

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'FAILED',
            completed_at = NULL
        WHERE id = $1
          AND status IN ('APPROVED', 'RECONCILING', 'FAILED')
      `,
      [sessionId],
      connection
    );

    await connection.query("COMMIT");
  } catch (failError) {
    await safeRollback(connection);
    console.error("[reconcile] Failed to mark job FAILED", failError);
  } finally {
    connection.release();
  }
}

async function processOneJob() {
  const connection = await postgres.getConnection();
  let claimedJobId = null;
  let claimedSessionId = null;
  let approvedByName = null;

  try {
    await connection.query("BEGIN");

    const jobRows = await postgres.execute(
      `
        SELECT id, session_id, attempts, status
        FROM reconciliation_jobs
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `,
      [],
      connection
    );

    if (jobRows.length === 0) {
      await connection.query("COMMIT");
      return false;
    }

    const job = jobRows[0];
    claimedJobId = job.id;
    claimedSessionId = job.session_id;

    const sessionRows = await postgres.execute(
      `
        SELECT
          s.id,
          s.warehouse_id,
          s.status,
          s.approved_by,
          u.id AS approved_by_user_id
        FROM audit_sessions s
        LEFT JOIN users u ON u.full_name = s.approved_by
        WHERE s.id = $1
        LIMIT 1
      `,
      [job.session_id],
      connection
    );

    const session = sessionRows[0];
    if (!session) {
      throw new Error(`Session ${job.session_id} not found for job ${job.id}`);
    }

    approvedByName = session.approved_by || null;
    await setAuditUser(connection, {
      name: await resolveAuditUserName(approvedByName, connection),
    });

    if (session.status === "COMPLETED") {
      await postgres.execute(
        `
          UPDATE reconciliation_jobs
          SET status = 'DONE',
              finished_at = COALESCE(finished_at, now()),
              last_error = NULL
          WHERE id = $1
        `,
        [job.id],
        connection
      );
      await connection.query("COMMIT");
      console.log(
        `[reconcile] job=${job.id} session=${session.id} already COMPLETED → DONE (no-op)`
      );
      return true;
    }

    if (!session.approved_by_user_id) {
      throw new Error(
        `Cannot resolve approved_by user id for session ${session.id} (approved_by=${session.approved_by})`
      );
    }

    await postgres.execute(
      `
        UPDATE reconciliation_jobs
        SET status = 'PROCESSING',
            attempts = attempts + 1,
            started_at = now(),
            finished_at = NULL,
            last_error = NULL
        WHERE id = $1
      `,
      [job.id],
      connection
    );

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'RECONCILING',
            completed_at = NULL
        WHERE id = $1
      `,
      [session.id],
      connection
    );

    const items = await postgres.execute(
      `
        SELECT product_id, counted_qty
        FROM session_items
        WHERE session_id = $1
        ORDER BY product_id
      `,
      [session.id],
      connection
    );

    for (const item of items) {
      const counted = toNumber(item.counted_qty);
      if (counted == null) {
        throw new Error(
          `session_items.counted_qty is null for product ${item.product_id}`
        );
      }

      const balanceRows = await postgres.execute(
        `
          SELECT on_hand_qty
          FROM inventory_balances
          WHERE warehouse_id = $1
            AND product_id = $2
          LIMIT 1
        `,
        [session.warehouse_id, item.product_id],
        connection
      );

      let qtyBefore;
      if (balanceRows.length === 0) {
        qtyBefore = 0;
        await postgres.execute(
          `
            INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty)
            VALUES ($1, $2, $3)
          `,
          [session.warehouse_id, item.product_id, counted],
          connection
        );
      } else {
        qtyBefore = toNumber(balanceRows[0].on_hand_qty);
        if (qtyBefore == null) {
          throw new Error(
            `Invalid on_hand_qty for product ${item.product_id}`
          );
        }

        await postgres.execute(
          `
            UPDATE inventory_balances
            SET on_hand_qty = $3
            WHERE warehouse_id = $1
              AND product_id = $2
          `,
          [session.warehouse_id, item.product_id, counted],
          connection
        );
      }

      if (qtyBefore !== counted) {
        const delta = counted - qtyBefore;
        await postgres.execute(
          `
            INSERT INTO inventory_audit_logs (
              warehouse_id,
              product_id,
              session_id,
              approved_by,
              qty_before,
              qty_after,
              delta
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (session_id, product_id) DO NOTHING
          `,
          [
            session.warehouse_id,
            item.product_id,
            session.id,
            session.approved_by_user_id,
            qtyBefore,
            counted,
            delta,
          ],
          connection
        );
      }
    }

    await postgres.execute(
      `
        UPDATE reconciliation_jobs
        SET status = 'DONE',
            finished_at = now(),
            last_error = NULL
        WHERE id = $1
      `,
      [job.id],
      connection
    );

    await postgres.execute(
      `
        UPDATE audit_sessions
        SET status = 'COMPLETED',
            completed_at = now()
        WHERE id = $1
      `,
      [session.id],
      connection
    );

    await connection.query("COMMIT");
    console.log(
      `[reconcile] job=${job.id} session=${session.id} COMPLETED items=${items.length}`
    );
    return true;
  } catch (error) {
    await safeRollback(connection);
    console.error(
      `[reconcile] job=${claimedJobId || "?"} failed:`,
      error.message || error
    );

    if (claimedJobId && claimedSessionId) {
      await markJobFailed(
        claimedJobId,
        claimedSessionId,
        approvedByName,
        error
      );
    }

    return true;
  } finally {
    connection.release();
  }
}

async function tick() {
  const reclaimed = await reclaimStaleProcessing();
  if (reclaimed > 0) {
    console.log(`[reconcile] reclaimed ${reclaimed} stale PROCESSING job(s)`);
  }

  const requeued = await requeueFailedJobs();
  if (requeued > 0) {
    console.log(`[reconcile] requeued ${requeued} FAILED job(s)`);
  }

  let processed = 0;
  while (true) {
    const didWork = await processOneJob();
    if (!didWork) break;
    processed += 1;
  }

  return processed;
}

async function startReconcileWorker() {
  console.log(
    `[reconcile] worker started poll=${POLL_INTERVAL_MS}ms stale=${STALE_PROCESSING_MS}ms maxAttempts=${MAX_ATTEMPTS}`
  );

  let stopped = false;

  const shutdown = (signal) => {
    if (stopped) return;
    stopped = true;
    console.log(`[reconcile] received ${signal}, stopping after current tick`);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  while (!stopped) {
    try {
      await tick();
    } catch (error) {
      console.error("[reconcile] tick error:", error.message || error);
    }

    if (stopped) break;
    await sleep(POLL_INTERVAL_MS);
  }

  console.log("[reconcile] worker stopped");
}

module.exports = {
  startReconcileWorker,
  tick,
  processOneJob,
  POLL_INTERVAL_MS,
  STALE_PROCESSING_MS,
  MAX_ATTEMPTS,
};
