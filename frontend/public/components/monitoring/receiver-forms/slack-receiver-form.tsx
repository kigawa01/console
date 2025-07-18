/* eslint-disable camelcase */
import * as _ from 'lodash-es';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Checkbox, FormGroup, Grid, GridItem, Radio, TextArea } from '@patternfly/react-core';

import { ExpandCollapse } from '../../utils';
import { ExternalLink } from '@console/shared/src/components/links/ExternalLink';
import { SendResolvedAlertsCheckbox } from './send-resolved-alerts-checkbox';
import { SaveAsDefaultCheckbox } from './save-as-default-checkbox';
import { FormProps } from './receiver-form-props';

const GLOBAL_FIELDS = [
  'slack_api_url',
  'slack_send_resolved',
  'slack_username',
  'slack_icon_emoji',
  'slack_icon_url',
  'slack_link_names',
  'slack_title',
  'slack_text',
];

export const Form: React.FC<FormProps> = ({ globals, formValues, dispatchFormChange }) => {
  const { t } = useTranslation();
  return (
    <div data-test-id="slack-receiver-form">
      <div className="form-group">
        <label data-test-id="api-url-label" className="co-required" htmlFor="slack-api-url">
          {t('public~Slack API URL')}
        </label>
        <Grid hasGutter>
          <GridItem span={7}>
            <span className="pf-v6-c-form-control">
              <input
                type="text"
                id="slack-api-url"
                aria-describedby="slack-api-url-help"
                data-test-id="slack-api-url"
                value={formValues.slack_api_url}
                onChange={(e) =>
                  dispatchFormChange({
                    type: 'setFormValues',
                    payload: { slack_api_url: e.target.value },
                  })
                }
              />
            </span>
          </GridItem>
          <GridItem span={1} /> {/* fixes an overlapping control issue */}
          <GridItem span={4}>
            <SaveAsDefaultCheckbox
              formField="slackSaveAsDefault"
              disabled={formValues.slack_api_url === globals?.slack_api_url}
              label={t('public~Save as default Slack API URL')}
              formValues={formValues}
              dispatchFormChange={dispatchFormChange}
              tooltip={t(
                'public~Checking this box will write the API URL to the global section of the configuration file where it will become the default API URL for future Slack receivers.',
              )}
            />
          </GridItem>
        </Grid>
        <div className="help-block" id="slack-api-url-help">
          {t('public~The URL of the Slack webhook.')}
        </div>
      </div>
      <div className="form-group">
        <label className="co-required" htmlFor="slack-channel">
          {t('public~Channel')}
        </label>
        <span className="pf-v6-c-form-control">
          <input
            type="text"
            id="slack-channel"
            aria-describedby="slack-channel-help"
            data-test-id="slack-channel"
            value={formValues.slackChannel}
            onChange={(e) =>
              dispatchFormChange({
                type: 'setFormValues',
                payload: { slackChannel: e.target.value },
              })
            }
          />
        </span>
        <div className="help-block" id="slack-channel-help">
          {t('public~The Slack channel or user to send notifications to.')}
        </div>
      </div>
      <div className="form-group">
        <ExpandCollapse
          textCollapsed={t('public~Show advanced configuration')}
          textExpanded={t('public~Hide advanced configuration')}
          dataTest="advanced-configuration"
        >
          <div className="co-form-subsection">
            <div className="form-group">
              <SendResolvedAlertsCheckbox
                formField="slack_send_resolved"
                formValues={formValues}
                dispatchFormChange={dispatchFormChange}
              />
            </div>
            <div className="form-group pf-v6-c-form">
              <FormGroup
                role="radiogroup"
                fieldId="slack-icon-type-group"
                label={t('public~Icon')}
                isInline
                className="pf-v6-c-form__group-control--no-row-gap"
              >
                <Radio
                  id="slack-icon-type"
                  name="slackIconType"
                  label={t('public~URL')}
                  value="url"
                  onChange={(e) =>
                    dispatchFormChange({
                      type: 'setFormValues',
                      payload: { slackIconType: (e.target as HTMLInputElement).value },
                    })
                  }
                  isChecked={formValues.slackIconType === 'url'}
                  data-checked-state={formValues.slackIconType === 'url'}
                  data-test="URL-radio-input"
                />
                <Radio
                  id="slack-icon-type-emoji"
                  name="slackIconType"
                  label={t('public~Emoji')}
                  value="emoji"
                  onChange={(e) =>
                    dispatchFormChange({
                      type: 'setFormValues',
                      payload: { slackIconType: (e.target as HTMLInputElement).value },
                    })
                  }
                  isChecked={formValues.slackIconType === 'emoji'}
                  data-checked-state={formValues.slackIconType === 'emoji'}
                  data-test="Emoji-radio-input"
                />
                {formValues.slackIconType === 'url' && (
                  <>
                    <span className="pf-v6-c-form-control">
                      <input
                        type="text"
                        aria-describedby="slack-icon-url-help"
                        aria-label={t('public~The URL of the icon.')}
                        data-test-id="slack-icon-url"
                        value={formValues.slack_icon_url}
                        onChange={(e) =>
                          dispatchFormChange({
                            type: 'setFormValues',
                            payload: { slack_icon_url: e.target.value },
                          })
                        }
                      />
                    </span>
                    <div className="help-block" id="slack-icon-url-help">
                      {t('public~The URL of the icon.')}
                    </div>
                  </>
                )}
                {formValues.slackIconType === 'emoji' && (
                  <>
                    <span className="pf-v6-c-form-control">
                      <input
                        type="text"
                        aria-describedby="slack-icon-emoji-help"
                        aria-label={t('public~An emoji code to use in place of the default icon.')}
                        name="slackIconEmoji"
                        data-test-id="slack-icon-emoji"
                        value={formValues.slack_icon_emoji}
                        onChange={(e) =>
                          dispatchFormChange({
                            type: 'setFormValues',
                            payload: { slack_icon_emoji: e.target.value },
                          })
                        }
                      />
                    </span>
                    <div className="help-block" id="slack-icon-emoji-help">
                      <Trans ns="public">
                        An{' '}
                        <ExternalLink
                          href="https://www.webfx.com/tools/emoji-cheat-sheet/"
                          text={t('public~emoji code')}
                        />{' '}
                        to use in place of the default icon.
                      </Trans>
                    </div>
                  </>
                )}
              </FormGroup>
            </div>
            <div className="form-group">
              <label htmlFor="slack-username">{t('public~Username')}</label>
              <span className="pf-v6-c-form-control">
                <input
                  type="text"
                  aria-describedby="slack-username-help"
                  id="slack-username"
                  data-test-id="slack-username"
                  value={formValues.slack_username}
                  onChange={(e) =>
                    dispatchFormChange({
                      type: 'setFormValues',
                      payload: { slack_username: e.target.value },
                    })
                  }
                />
              </span>
              <div className="help-block" id="slack-username-help">
                {t('public~The displayed username.')}
              </div>
            </div>
            <div className="form-group">
              <Checkbox
                label={t('public~Link names')}
                onChange={(_event, checked) =>
                  dispatchFormChange({
                    type: 'setFormValues',
                    payload: { slack_link_names: checked },
                  })
                }
                isChecked={formValues.slack_link_names}
                id="slack-link-names"
                data-test-id="slack-link-names"
              />
              <div className="help-block" id="slack-link-names-help">
                {t('public~Find and link channel names and usernames.')}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="slack-title">{t('public~Title')}</label>
              <TextArea
                id="slack-title"
                aria-describedby="slack-title-help"
                onChange={(_event, value) =>
                  dispatchFormChange({
                    type: 'setFormValues',
                    payload: { slack_title: value },
                  })
                }
                value={formValues.slack_title}
              />
              <div className="help-block" id="slack-title-help">
                {t('public~The title of the Slack message.')}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="slack-text">{t('public~Text')}</label>
              <TextArea
                id="slack-text"
                aria-describedby="slack-text-help"
                onChange={(_event, value) =>
                  dispatchFormChange({
                    type: 'setFormValues',
                    payload: { slack_text: value },
                  })
                }
                value={formValues.slack_text}
              />
              <div className="help-block" id="slack-text-help">
                {t('public~The text of the Slack message.')}
              </div>
            </div>
          </div>
        </ExpandCollapse>
      </div>
    </div>
  );
};

export const getInitialValues = (globals, receiverConfig) => {
  const initValues: any = {
    slackSaveAsDefault: false,
    slackChannel: _.get(receiverConfig, 'channel'),
  };

  initValues.slackIconType = _.has(receiverConfig, 'icon_emoji') ? 'emoji' : 'url';

  GLOBAL_FIELDS.forEach((fld) => {
    const configFieldName = fld.substring(fld.indexOf('_') + 1); //strip off leading 'slack_' prefix
    initValues[fld] = _.get(receiverConfig, configFieldName, globals[fld]);
  });

  return initValues;
};

export const isFormInvalid = (formValues): boolean => {
  return !formValues.slack_api_url || !formValues.slackChannel;
};

export const updateGlobals = (globals, formValues) => {
  const updatedGlobals = {};
  if (formValues.slackSaveAsDefault && formValues.slack_api_url) {
    _.set(updatedGlobals, 'slack_api_url', formValues.slack_api_url);
  }
  return updatedGlobals;
};

export const createReceiverConfig = (globals, formValues, receiverConfig) => {
  _.set(receiverConfig, 'channel', formValues.slackChannel);

  // Only save these props in receiverConfig if different from global
  GLOBAL_FIELDS.forEach((fld) => {
    const formValue = formValues[fld];
    const configFieldName = fld.substring(fld.indexOf('_') + 1); //strip off leading 'slack_' prefix
    if (formValue !== globals[fld]) {
      if (fld === 'slack_api_url' && formValues.slackSaveAsDefault) {
        _.unset(receiverConfig, 'api_url'); // saving as global so unset in config
      } else {
        _.set(receiverConfig, configFieldName, formValue);
      }
    } else {
      _.unset(receiverConfig, configFieldName); // equals global, unset in config so global is used
    }
  });

  _.unset(receiverConfig, formValues.slackIconType === 'url' ? 'icon_emoji' : 'icon_url');

  return receiverConfig;
};
