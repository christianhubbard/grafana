import { omit } from 'lodash';

import {
  FieldColorModeId,
  FieldType,
  type DataFrame,
  type Field,
  getFieldDisplayName,
  getTimeField,
} from '@grafana/data';
import { GraphDrawStyle, StackingMode, type GraphFieldConfig } from '@grafana/schema';

/** Matches `defaultWindowOptions.windowSize` in calculateField transformer (10% of frame length). */
export const EXPLORE_MOVING_AVERAGE_WINDOW_PCT = 0.1;

/** Fixed color for moving-average overlay lines and legend markers (bright pink). */
export const MOVING_AVERAGE_SERIES_HEX = '#FF1493';

export function exploreMovingAverageWindowSize(frameLength: number): number {
  return Math.max(1, Math.ceil(EXPLORE_MOVING_AVERAGE_WINDOW_PCT * frameLength));
}

function uniqueOverlayDisplayName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    return base;
  }
  let i = 2;
  while (used.has(`${base} (${i})`)) {
    i++;
  }
  return `${base} (${i})`;
}

function collectNumericFieldDisplayNames(frames: DataFrame[]): Set<string> {
  const names = new Set<string>();
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }
      names.add(getFieldDisplayName(field, frame, frames));
    }
  }
  return names;
}

/**
 * Trailing moving mean aligned with Grafana's calculateField WindowFunctions + trailing alignment.
 */
function trailingMovingMean(selectedField: Field, frameLength: number, window: number): number[] {
  const vals: number[] = [];
  let sum = 0;
  let count = 0;
  const selectedValues = selectedField.values;

  for (let i = 0; i < frameLength; i++) {
    const currentValue = selectedValues[i];
    if (currentValue !== null && currentValue !== undefined) {
      count++;
      sum += Number(currentValue);

      if (i > window - 1) {
        const prev = selectedValues[i - window];
        if (prev != null) {
          sum -= Number(prev);
          count--;
        }
      }
    }
    vals.push(count === 0 ? 0 : sum / count);
  }

  return vals;
}

function buildOverlayFieldConfig(source: Field<number>, overlayDisplayName: string): Field['config'] {
  const prev = source.config?.custom;
  const base =
    prev !== undefined && prev !== null && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...prev }
      : {};
  const sourceCustom: GraphFieldConfig = base;
  const custom: GraphFieldConfig = {
    ...sourceCustom,
    drawStyle: GraphDrawStyle.Line,
    fillOpacity: 0,
    stacking:
      sourceCustom.stacking && sourceCustom.stacking.mode !== undefined
        ? {
            ...sourceCustom.stacking,
            mode: StackingMode.None,
          }
        : { mode: StackingMode.None, group: sourceCustom.stacking?.group ?? 'A' },
  };

  return {
    ...source.config,
    displayName: overlayDisplayName,
    color: {
      mode: FieldColorModeId.Fixed,
      fixedColor: MOVING_AVERAGE_SERIES_HEX,
    },
    custom,
  };
}

/**
 * Adds a trailing moving average numeric field after each original numeric field when the frame has a Time field.
 */
export function addMovingAverageOverlay(originalFrames: DataFrame[]): DataFrame[] {
  const usedDisplayNames = collectNumericFieldDisplayNames(originalFrames);

  return originalFrames.map((frame) => {
    const { timeField } = getTimeField(frame);
    if (!timeField) {
      return frame;
    }

    const frameLength = frame.length;
    if (frameLength === 0) {
      return frame;
    }

    const numericFields = frame.fields.filter((field) => field.type === FieldType.number);
    if (numericFields.length === 0) {
      return frame;
    }

    const windowSize = exploreMovingAverageWindowSize(frameLength);
    const fields = [...frame.fields];

    // Only iterate numeric fields already in the incoming frame so we don't process overlays we appended.
    for (let i = 0; i < numericFields.length; i++) {
      const field = numericFields[i];

      const displayNameBase = getFieldDisplayName(field, frame, originalFrames);

      let overlayDisplayName = `${displayNameBase} moving average`;
      overlayDisplayName = uniqueOverlayDisplayName(overlayDisplayName, usedDisplayNames);
      usedDisplayNames.add(overlayDisplayName);

      const fieldNameStem = `${field.name ?? displayNameBase}`.replace(/\s+/g, ' ').slice(0, 120);

      /** Internal field.name used for matchers; avoids collisions when several series share a base name */
      let overlayFieldName = `${fieldNameStem} MA`;
      let suffix = 1;
      while (fields.some((f) => f.name === overlayFieldName)) {
        overlayFieldName = `${fieldNameStem} MA ${suffix++}`;
      }

      const overlayValues = trailingMovingMean(field, frameLength, windowSize);

      const overlayBase = omit(field, 'state');

      const overlayField: Field<number> = {
        ...overlayBase,
        name: overlayFieldName,
        values: overlayValues,
        config: buildOverlayFieldConfig(field, overlayDisplayName),
      };

      fields.push(overlayField);
    }

    return { ...frame, fields };
  });
}
