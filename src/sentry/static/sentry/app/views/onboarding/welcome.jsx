import React from 'react';
import styled from 'react-emotion';

import {analytics} from 'app/utils/analytics';
import {stepPropTypes} from 'app/views/onboarding/wizardNew';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import withConfig from 'app/utils/withConfig';
import withOrganization from 'app/utils/withOrganization';

const recordAnalyticsOnboardingSkipped = ({organization}) =>
  analytics('onboarding_v2.skipped', {
    org_id: parseInt(organization.id, 10),
  });

class OnboardingWelcome extends React.Component {
  static propTypes = {
    ...stepPropTypes,
    config: SentryTypes.Config.isRequired,
  };

  skipOnboarding = () => {
    const {organization} = this.props;
    recordAnalyticsOnboardingSkipped({organization});
  };

  render() {
    const {onComplete, config, active} = this.props;
    const {user} = config;

    return (
      <React.Fragment>
        <p>
          {tct("We're happy you're here, [name]!", {
            name: <strong>{user.name.split(' ')[0]}</strong>,
          })}
        </p>
        <p>
          {t(
            `With Sentry, you can find and fix bugs before your customers even
             notice a problem. When things go to hell, we'll help you fight the
             fires. Let's get started!`
          )}
        </p>
        <ul>
          <li>{t('Choose your platform.')}</li>
          <li>
            {t(
              `Install and verify the integration of Sentry into your
               application by sending your first event.`
            )}
          </li>
        </ul>
        <ActionGroup>
          <Button
            data-test-id="welcome-next"
            disabled={!active}
            priority="primary"
            onClick={() => onComplete()}
          >
            {t("I'm Ready!")}
          </Button>
          <SecondaryAction>
            {tct('Not your first Sentry rodeo? [exitLink:Skip this onboarding].', {
              exitLink: <Button priority="link" onClick={this.skipOnboarding} to="/" />,
            })}
          </SecondaryAction>
        </ActionGroup>
      </React.Fragment>
    );
  }
}

const ActionGroup = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SecondaryAction = styled('small')`
  color: ${p => p.theme.gray3};
`;

export default withOrganization(withConfig(OnboardingWelcome));
