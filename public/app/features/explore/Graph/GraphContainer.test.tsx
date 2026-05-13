import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  EventBusSrv,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  MutableDataFrame,
} from '@grafana/data';

jest.mock('./ExploreGraph', () => ({
  ExploreGraph: jest.fn(() => null),
}));

import { ExploreGraph } from './ExploreGraph';
import { GraphContainer } from './GraphContainer';

const exploreGraphMock = ExploreGraph as jest.MockedFunction<typeof ExploreGraph>;

function buildMinimalFrame(): MutableDataFrame {
  const frame = new MutableDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1000, 2000] },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [1, 2],
      },
    ],
  });
  frame.name = 'A';
  frame.refId = 'A';

  return frame;
}

describe('GraphContainer', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('passes query frames directly to ExploreGraph when Moving avg is off', () => {
    render(
      <GraphContainer
        width={400}
        height={300}
        data={[buildMinimalFrame()]}
        annotations={[]}
        eventBus={new EventBusSrv()}
        timeRange={getDefaultTimeRange()}
        timeZone="utc"
        onChangeTime={() => {}}
        splitOpenFn={() => {}}
        loadingState={LoadingState.Done}
      />
    );

    const lastPayload = exploreGraphMock.mock.calls.at(-1)?.[0];
    expect(lastPayload?.data).toHaveLength(1);
  });

  it('appends moving-average overlays when Moving avg toggle is enabled', async () => {
    const user = userEvent.setup();
    render(
      <GraphContainer
        width={400}
        height={300}
        data={[buildMinimalFrame()]}
        annotations={[]}
        eventBus={new EventBusSrv()}
        timeRange={getDefaultTimeRange()}
        timeZone="utc"
        onChangeTime={() => {}}
        splitOpenFn={() => {}}
        loadingState={LoadingState.Done}
      />
    );

    await user.click(screen.getByRole('switch', { name: /moving avg/i }));

    const lastPayload = exploreGraphMock.mock.calls.at(-1)?.[0];
    expect(lastPayload?.data).toHaveLength(2);
  });
});
