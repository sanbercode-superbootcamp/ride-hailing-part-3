import { Request, Response } from "express";
import { get as httpGet } from "request-promise-native";
import { StatusCodeError } from "request-promise-native/errors";
import { createTracer } from "../lib/tracer";
import { Span, FORMAT_HTTP_HEADERS, Tags } from "opentracing";

const tracer = createTracer("monitoring-service");

export async function getRiderReport(req: Request, res: Response) {
  const parentSpan = tracer.startSpan("report");
  const span = tracer.startSpan("parsing_report", { childOf: parentSpan });
  const rider_id = req.params.rider_id;
  if (!rider_id) {
    span.setTag("error", true);
    span.log({
      event: "error parsing",
      message: "parameter tidak lengkap"
    });
    res.status(400).json({
      ok: false,
      error: "parameter tidak lengkap"
    });
    span.finish();
    parentSpan.finish();
    return;
  }

  // get rider position
  let position: RiderPosition;
  let logs: RiderLog[] = [];
  const span2 = tracer.startSpan("report_get_position", {
    childOf: parentSpan
  });
  try {
    parentSpan.setTag("rider_id", rider_id);
    position = await getPosition(rider_id, span2);
    span2.finish();
  } catch (err) {
    span2.setTag("error", true);
    span2.log({
      event: "error",
      message: err.toString()
    });
    if (err instanceof StatusCodeError) {
      res.status(err.statusCode).json({
        ok: false,
        error: err.response.body.error
      });
      span2.finish();
      parentSpan.finish();
      return;
    }
    res.status(500).json({
      ok: false,
      error: "gagal melakukan request"
    });
    span2.finish();
    parentSpan.finish();
    return;
  }

  const span3 = tracer.startSpan("report_get_movement", {
    childOf: parentSpan
  });
  try {
    logs = await getMovementLogs(rider_id, span3);
    span3.finish();
  } catch (err) {
    span3.setTag("error", true);
    span3.log({
      event: "error",
      message: err.toString()
    });
    if (err instanceof StatusCodeError) {
      res.status(err.statusCode).json({
        ok: false,
        error: err.response.body.error
      });
      span3.finish();
      parentSpan.finish();
      return;
    }
    res.status(500).json({
      ok: false,
      error: "gagal melakukan request"
    });
    span3.finish();
    parentSpan.finish();
    return;
  }

  // encode output
  const span4 = tracer.startSpan("encode_report_result", {
    childOf: parentSpan
  });
  res.json({
    ok: true,
    position,
    logs
  });
  span4.finish();
  parentSpan.finish();
}

const POSITION_PORT = process.env["POSITION_PORT"] || 3001;
const TRACKER_PORT = process.env["TRACKER_PORT"] || 3000;

export interface RiderPosition {
  latitude: number;
  longitude: number;
}

async function getPosition(
  rider_id: number | string,
  span: Span
): Promise<RiderPosition> {
  const url = `http://localhost:${POSITION_PORT}/position/${rider_id}`;

  const headers = {};
  tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
  const res = await httpGet(url, {
    json: true,
    headers
  });

  return {
    latitude: res.latitude,
    longitude: res.longitude
  };
}

export interface RiderLog {
  time: Date;
  east: number;
  west: number;
  north: number;
  south: number;
}

export async function getMovementLogs(
  rider_id: number | string,
  span: Span
): Promise<RiderLog[]> {
  tracer.inject(span, FORMAT_HTTP_HEADERS, {});
  const res = await httpGet(
    `http://localhost:${TRACKER_PORT}/movement/${rider_id}`,
    {
      json: true
    }
  );

  return res.logs;
}
