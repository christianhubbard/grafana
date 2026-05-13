import {
  DataTransformerID,
  FieldColorModeId,
  FieldType,
  ReducerID,
  type DataFrame,
  type DataTransformerConfig,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import {
  CalculateFieldMode,
  WindowAlignment,
  WindowSizeMode,
  defaultWindowOptions,
  mockTransformationsRegistry,
} from '@grafana/data/internal';

import { calculateFieldTransformer } from '../../../../../packages/grafana-data/src/transformations/transformers/calculateField';

import {
  MOVING_AVERAGE_SERIES_HEX,
  addMovingAverageOverlay,
  exploreMovingAverageWindowSize,
} from './movingAverage';

const windowTransformConfig = (fieldName: string): DataTransformerConfig => ({
  id: DataTransformerID.calculateField,
  options: {
    mode: CalculateFieldMode.WindowFunctions,
    window: {
      field: fieldName,
      reducer: ReducerID.mean,
      windowAlignment: WindowAlignment.Trailing,
      windowSizeMode: WindowSizeMode.Percentage,
      windowSize: defaultWindowOptions.windowSize,
    },
    alias: 'MA ref',
    timeSeries: true,
    replaceFields: false,
  },
});

async function expectedMovingAvgFromCalculator(frame: DataFrame, valueFieldName: string): Promise<number[]> {
  const cfg = windowTransformConfig(valueFieldName);
  let result: DataFrame[] = [];
  await expect(transformDataFrame([cfg], [frame])).toEmitValuesWith((received: DataFrame[][]) => {
    result = received[received.length - 1];
    return undefined;
  });
  const transformed = result[0];
  const overlay = transformed.fields[transformed.fields.length - 1];
  expect(overlay.values).toHaveLength(transformed.length);
  return [...overlay.values] as number[];
}

describe('addMovingAverageOverlay', () => {
  beforeAll(() => {
    mockTransformationsRegistry([calculateFieldTransformer]);
  });

  describe('exploreMovingAverageWindowSize', () => {
    it('uses 10% of frame length rounded up with a minimum of 1', () => {
      expect(exploreMovingAverageWindowSize(50)).toBe(5);
      expect(exploreMovingAverageWindowSize(3)).toBe(1);
      expect(exploreMovingAverageWindowSize(1)).toBe(1);
    });
  });

  it('returns frames unchanged when there is no time field', () => {
    const frame = toDataFrame({
      fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
    });

    expect(addMovingAverageOverlay([frame])).toEqual([frame]);
  });

  it('does not mutate the original frames', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, 100] },
      ],
    });
    const before = frame.fields.map((f) => [...(f.values as number[])]);
    addMovingAverageOverlay([frame]);

    frame.fields.forEach((f, fi) => {
      expect([...(f.values as number[])]).toEqual(before[fi]);
    });
  });

  it('matches calculateField trailing window mean for numeric series', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'Value', type: FieldType.number, values: [1, 2, 100] },
      ],
    });

    const expected = await expectedMovingAvgFromCalculator(frame, 'Value');

    const [withOverlay] = addMovingAverageOverlay([frame]);
    const overlayField = withOverlay.fields[withOverlay.fields.length - 1];

    expect(overlayField.name).toMatch(/MA$/);
    expect(overlayField.config?.displayName).toContain('moving average');
    expect(overlayField.config?.color?.mode).toBe(FieldColorModeId.Fixed);
    expect(overlayField.config?.color?.fixedColor).toBe(MOVING_AVERAGE_SERIES_HEX);

    expect([...(overlayField.values as number[])]).toEqual(expected);
  });

  it('creates distinct legend names when multiple frames might share a base series name', () => {
    const duplicateNameFrame = (vals: number[]) =>
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: vals.map((_, i) => 1000 * (i + 1)) },
          {
            name: 'Value',
            type: FieldType.number,
            values: vals,
          },
        ],
      });

    const a = duplicateNameFrame([1, 2]);
    const b = duplicateNameFrame([4, 5]);

    const [outA, outB] = addMovingAverageOverlay([a, b]);
    expect(outA.fields[outA.fields.length - 1].config?.displayName).not.toEqual(
      outB.fields[outB.fields.length - 1].config?.displayName
    );
  });
});
