import { useCallback, useId, useMemo, useState } from 'react';
import { useToggle } from 'react-use';

import {
  type DataFrame,
  type EventBus,
  type AbsoluteTimeRange,
  type TimeZone,
  type SplitOpen,
  type LoadingState,
  type ThresholdsConfig,
  type TimeRange,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  type GraphThresholdsStyleConfig,
  InlineSwitch,
  PanelChrome,
  Stack,
  Tooltip,
  type PanelChromeProps,
} from '@grafana/ui';
import { type ExploreGraphStyle } from 'app/types/explore';

import { LimitedDataDisclaimer } from '../LimitedDataDisclaimer';
import { storeGraphStyle } from '../state/utils';

import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { MOVING_AVG_WINDOW, addMovingAverageFrames } from './movingAverage';
import { loadGraphStyle, loadMovingAvgEnabled, storeMovingAvgEnabled } from './utils';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  timeRange: TimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
  queriesChangedIndexAtRun?: number;
}

export const GraphContainer = ({
  data,
  eventBus,
  height,
  width,
  timeRange,
  timeZone,
  annotations,
  onChangeTime,
  splitOpenFn,
  thresholdsConfig,
  thresholdsStyle,
  loadingState,
  statusMessage,
  queriesChangedIndexAtRun,
}: Props) => {
  const movingAvgToggleId = useId();
  const [showAllSeries, toggleShowAllSeries] = useToggle(false);
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const [showMovingAvg, setShowMovingAvg] = useState(loadMovingAvgEnabled);

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);

  const onMovingAvgChange = useCallback(() => {
    setShowMovingAvg((previous) => {
      const next = !previous;
      storeMovingAvgEnabled(next);
      return next;
    });
  }, []);

  const slicedData = useMemo(() => {
    return showAllSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
  }, [data, showAllSeries]);

  const dataWithMovingAvg = useMemo(() => {
    return showMovingAvg ? addMovingAverageFrames(slicedData) : slicedData;
  }, [showMovingAvg, slicedData]);

  return (
    <PanelChrome
      title={t('graph.container.title', 'Graph')}
      titleItems={[
        !showAllSeries && MAX_NUMBER_OF_TIME_SERIES < data.length && (
          <LimitedDataDisclaimer
            key="disclaimer"
            toggleShowAllSeries={toggleShowAllSeries}
            info={
              <Trans i18nKey={'graph.container.show-only-series'}>
                Showing only {{ MAX_NUMBER_OF_TIME_SERIES }} series
              </Trans>
            }
            buttonLabel={<Trans i18nKey={'graph.container.show-all-series'}>Show all {{ length: data.length }}</Trans>}
            tooltip={t(
              'graph.container.content',
              'Rendering too many series in a single panel may impact performance and make data harder to read. Consider refining your queries.'
            )}
          />
        ),
      ].filter(Boolean)}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
      actions={
        <Stack gap={2} justifyContent={'flex-end'} alignItems={'center'} direction={'row'}>
          <Tooltip
            content={t(
              'graph.container.moving-avg-tooltip',
              'Shows a dashed trailing {{window}}-point moving average overlay for each series.',
              { window: MOVING_AVG_WINDOW }
            )}
          >
            <span>
              <InlineSwitch
                transparent
                showLabel
                label={t('graph.container.moving-avg', 'Moving avg')}
                value={showMovingAvg}
                onChange={onMovingAvgChange}
                id={movingAvgToggleId}
              />
            </span>
          </Tooltip>
          <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />
        </Stack>
      }
    >
      {(innerWidth, innerHeight) => (
        <ExploreGraph
          graphStyle={graphStyle}
          data={dataWithMovingAvg}
          height={innerHeight}
          width={innerWidth}
          timeRange={timeRange}
          onChangeTime={onChangeTime}
          timeZone={timeZone}
          annotations={annotations}
          splitOpenFn={splitOpenFn}
          loadingState={loadingState}
          thresholdsConfig={thresholdsConfig}
          thresholdsStyle={thresholdsStyle}
          eventBus={eventBus}
          queriesChangedIndexAtRun={queriesChangedIndexAtRun}
        />
      )}
    </PanelChrome>
  );
};
