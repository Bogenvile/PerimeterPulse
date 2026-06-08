import { InfluxDB, Point } from "@influxdata/influxdb-client";

const url =
  process.env.INFLUXDB_URL || "http://localhost:8086";
const token =
  process.env.INFLUXDB_TOKEN || "perimeterpulse-token";
const org =
  process.env.INFLUXDB_ORG || "perimeterpulse";
const bucket =
  process.env.INFLUXDB_BUCKET || "perimeterpulse";

let client: InfluxDB | null = null;
let writeApi: ReturnType<InfluxDB["getWriteApi"]> | null = null;
let queryApi: ReturnType<InfluxDB["getQueryApi"]> | null = null;

function getClient(): InfluxDB {
  if (!client) {
    client = new InfluxDB({ url, token });
  }
  return client;
}

export function getWriteApi() {
  if (!writeApi) {
    writeApi = getClient().getWriteApi(org, bucket, "ms");
  }
  return writeApi;
}

export function getQueryApi() {
  if (!queryApi) {
    queryApi = getClient().getQueryApi(org);
  }
  return queryApi;
}

export function writeMetric(
  agentId: string,
  metric: {
    cpu_percent: number;
    ram_percent: number;
    ram_used_bytes: number;
    ram_total_bytes: number;
    storage_percent: number;
    storage_used_bytes: number;
    storage_total_bytes: number;
    uptime_seconds: number;
    network_status: string;
    network_latency_ms: number;
  },
) {
  const point = new Point("agent_metrics")
    .tag("agent_id", agentId)
    .floatField("cpu_percent", metric.cpu_percent)
    .floatField("ram_percent", metric.ram_percent)
    .intField("ram_used_bytes", metric.ram_used_bytes)
    .intField("ram_total_bytes", metric.ram_total_bytes)
    .floatField("storage_percent", metric.storage_percent)
    .intField("storage_used_bytes", metric.storage_used_bytes)
    .intField("storage_total_bytes", metric.storage_total_bytes)
    .intField("uptime_seconds", metric.uptime_seconds)
    .stringField("network_status", metric.network_status)
    .floatField("network_latency_ms", metric.network_latency_ms);

  getWriteApi().writePoint(point);
}

export function writeLocation(
  agentId: string,
  loc: {
    latitude: number;
    longitude: number;
    accuracy_meters: number;
    source: "os" | "geoip";
  },
) {
  const point = new Point("agent_location")
    .tag("agent_id", agentId)
    .tag("source", loc.source)
    .floatField("latitude", loc.latitude)
    .floatField("longitude", loc.longitude)
    .floatField("accuracy_meters", loc.accuracy_meters);

  getWriteApi().writePoint(point);
}

export async function queryMetrics(
  agentId: string,
  rangeStart: string,
): Promise<
  {
    time: string;
    cpu_percent: number;
    ram_percent: number;
    storage_percent: number;
    network_status: string;
    network_latency_ms: number;
  }[]
> {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${rangeStart})
      |> filter(fn: (r) => r["_measurement"] == "agent_metrics")
      |> filter(fn: (r) => r["agent_id"] == "${agentId}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])
  `;

  const result: {
    time: string;
    cpu_percent: number;
    ram_percent: number;
    storage_percent: number;
    network_status: string;
    network_latency_ms: number;
  }[] = [];

  return new Promise((resolve, reject) => {
    getQueryApi().queryRows(fluxQuery, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        result.push({
          time: obj._time,
          cpu_percent: obj.cpu_percent ?? 0,
          ram_percent: obj.ram_percent ?? 0,
          storage_percent: obj.storage_percent ?? 0,
          network_status: obj.network_status ?? "unknown",
          network_latency_ms: obj.network_latency_ms ?? 0,
        });
      },
      error(err) {
        reject(err);
      },
      complete() {
        resolve(result);
      },
    });
  });
}

export async function queryLocations(
  agentId: string,
  rangeStart: string,
): Promise<
  { time: string; latitude: number; longitude: number; source: string }[]
> {
  const fluxQuery = `
    from(bucket: "${bucket}")
      |> range(start: ${rangeStart})
      |> filter(fn: (r) => r["_measurement"] == "agent_location")
      |> filter(fn: (r) => r["agent_id"] == "${agentId}")
      |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"])
  `;

  const result: {
    time: string;
    latitude: number;
    longitude: number;
    source: string;
  }[] = [];

  return new Promise((resolve, reject) => {
    getQueryApi().queryRows(fluxQuery, {
      next(row, tableMeta) {
        const obj = tableMeta.toObject(row);
        result.push({
          time: obj._time,
          latitude: obj.latitude ?? 0,
          longitude: obj.longitude ?? 0,
          source: obj.source ?? "unknown",
        });
      },
      error(err) {
        reject(err);
      },
      complete() {
        resolve(result);
      },
    });
  });
}

export async function flushWrites() {
  try {
    await getWriteApi().flush();
  } catch {
    // silently ignore flush errors
  }
}
