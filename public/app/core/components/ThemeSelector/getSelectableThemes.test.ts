import { getSelectableThemes } from './getSelectableThemes';

jest.mock('@grafana/runtime', () => ({
  config: {
    featureToggles: {
      colorblindThemes: false,
      grafanaconThemes: false,
    },
  },
}));

describe('getSelectableThemes', () => {
  it('always includes Purple dusk without feature toggles', () => {
    const ids = getSelectableThemes().map((t) => t.id);

    expect(ids).toContain('purpledusk');
  });
});
