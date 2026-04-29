import { FieldType, toDataFrame } from '@grafana/data';

import {
  MOVING_AVG_WINDOW,
  addMovingAverageFrames,
  trailingMovingMean,
} from './movingAverage';

describe('explore moving average helpers', () => {
  describe('trailingMovingMean', () => {
    it('rejects invalid window sizes', () => {
      expect(() => trailingMovingMean([1], 0)).toThrow();
      expect(() => trailingMovingMean([1], -1)).toThrow();
    });

    it('warms up with null until the window is full', () => {
      expect(trailingMovingMean([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
    });

    it('computes trailing means for larger windows', () => {
      const series = Array.from({ length: 12 }, (_, i) => i + 1);
      expect(trailingMovingMean(series, MOVING_AVG_WINDOW).slice(9)).toEqual([55 / 10, 65 / 10, 75 / 10]);
    });

    it('fills with null when the series is shorter than the window', () => {
      const short = trailingMovingMean([1, 2, 3], MOVING_AVG_WINDOW);
      expect(short.every((v) => v === null)).toBe(true);
    });

    it('handles gaps without producing NaN', () => {
      const result = trailingMovingMean([1, null, 3], 3);
      expect(result[2]).not.toBeNaN();
    });
  });

  describe('addMovingAverageFrames', () => {
    it('does nothing for empty frames', () => {
      expect(addMovingAverageFrames([], 5)).toEqual([]);
    });

    it('skips frames without a time dimension', () => {
      const noTimeFrame = toDataFrame({
        fields: [{ name: 'x', type: FieldType.number, values: [1, 2, 3] }],
      });
      const result = addMovingAverageFrames([noTimeFrame], 10);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(noTimeFrame);
    });

    it('pairs each input frame with a moving-average frame', () => {
      const frame = toDataFrame({
        refId: 'A',
        name: 'latency',
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1000, 2000, 3000, 4000, 5000],
          },
          {
            name: 'Value',
            type: FieldType.number,
            config: { displayNameFromDS: 'requests' },
            values: [1, 2, 3, 4, 5],
          },
        ],
      });

      const result = addMovingAverageFrames([frame], 3);
      expect(result.length).toBe(2);
      expect(result[1]?.name).toBe('latency (avg 3)');
      expect(result[1]?.fields.some((field) => field.name === 'Time')).toBeTruthy();
      expect(result[1]?.fields.some((field) => field.name === 'Value')).toBeTruthy();
    });
  });
});
