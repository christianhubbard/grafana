import { merge } from 'lodash';

import { MutableDataFrame, type DataFrame, type Field, FieldType } from '@grafana/data';
import { type GraphFieldConfig } from '@grafana/schema';

export const MOVING_AVG_WINDOW = 10;

/** Trailing mean over numeric values; aligns with Grafana calculate-field window reducer, with warmup nulls */
export function trailingMovingMean(
  values: Array<number | string | boolean | undefined | null>,
  windowSize: number
): Array<number | null> {
  if (windowSize <= 0) {
    throw new Error('Moving average window size must be larger than 0');
  }

  const n = values.length;
  const result: Array<number | null> = [];

  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    const currentValue = values[i];

    if (isNumericValue(currentValue)) {
      count++;
      sum += currentValue;

      if (i > windowSize - 1) {
        const leave = values[i - windowSize];
        if (isNumericValue(leave)) {
          sum -= leave;
          count--;
        }
      }
    }

    if (i < windowSize - 1) {
      result.push(null);
    } else {
      result.push(count === 0 ? null : sum / count);
    }
  }

  return result;
}

function isNumericValue(v: unknown): v is number {
  return typeof v === 'number' && v != null && !Number.isNaN(v);
}

function appendAvgSuffix(displayName: string, windowSize: number): string {
  return `${displayName} (avg ${windowSize})`;
}

function resolveFieldDisplayStem(field: Field): string {
  return field.config.displayNameFromDS ?? field.config.displayName ?? field.name;
}

function mergeGraphCustom(existing: unknown): GraphFieldConfig {
  const dashed = { lineStyle: { dash: [10, 10] } } satisfies GraphFieldConfig;

  const patch = typeof existing === 'object' && existing !== null ? existing : {};

  // lodash merge performs a deep merge; Grafana field custom config is loosely typed coming from datasource frames.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- lodash merge return is not narrowed to GraphFieldConfig
  return merge({}, dashed, patch) as GraphFieldConfig;
}

function samplesForMovingAverage(vf: Field): Array<number | string | boolean | undefined | null> {
  return Array.from(vf.values);
}

/** @returns A new numeric field overlay with dashed line style and averaged values */
function buildMovingAverageNumericField(original: Field, averaged: Array<number | null>, windowSize: number): Field {
  const mergedCustom = mergeGraphCustom(original.config.custom);

  return {
    ...original,
    config: {
      ...original.config,
      displayNameFromDS: appendAvgSuffix(resolveFieldDisplayStem(original), windowSize),
      custom: mergedCustom,
    },
    values: averaged,
    state: original.state ? { ...original.state } : original.state,
  };
}

/** Appends dashed moving-average overlay frames for each time-series frame in `frames`. */
export function addMovingAverageFrames(frames: DataFrame[], windowSize = MOVING_AVG_WINDOW): DataFrame[] {
  if (frames.length === 0 || windowSize <= 0) {
    return frames;
  }

  const out: DataFrame[] = [...frames];

  for (const frame of frames) {
    const maFrame = createMovingAverageFrame(frame, windowSize);
    if (maFrame != null) {
      out.push(maFrame);
    }
  }

  return out;
}

function createMovingAverageFrame(frame: DataFrame, windowSize: number): MutableDataFrame | null {
  const timeField = frame.fields.find((f) => f.type === FieldType.time);
  if (!timeField) {
    return null;
  }

  const valueFields = frame.fields.filter((f) => f.type === FieldType.number);
  if (valueFields.length === 0) {
    return null;
  }

  const clonedTime = {
    ...timeField,
    values: Array.from(timeField.values),
    ...(timeField.nanos ? { nanos: [...timeField.nanos] } : {}),
  };

  const maValueFields = valueFields.map((vf) =>
    buildMovingAverageNumericField(vf, trailingMovingMean(samplesForMovingAverage(vf), windowSize), windowSize)
  );

  const mdf = new MutableDataFrame();
  if (frame.name) {
    mdf.name = appendAvgSuffix(frame.name, windowSize);
  }
  mdf.refId = frame.refId;
  if (frame.meta != null) {
    mdf.meta = { ...frame.meta };
  }
  mdf.addField(clonedTime);
  for (const f of maValueFields) {
    mdf.addField(f);
  }

  return mdf;
}
