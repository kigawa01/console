import { Given, When, Then, And } from 'cypress-cucumber-preprocessor/steps';
import { guidedTour } from '@console/cypress-integration-tests/views/guided-tour';
import { switchPerspective } from '@console/dev-console/integration-tests/support/constants';
import { perspective } from '@console/dev-console/integration-tests/support/pages';
import { checkDeveloperPerspective } from '@console/dev-console/integration-tests/support/pages/functions/checkDeveloperPerspective';
import { checkTerminalIcon } from '@console/dev-console/integration-tests/support/pages/functions/checkTerminalIcon';
import { webTerminalPage } from '@console/webterminal-plugin/integration-tests/support/step-definitions/pages/web-terminal/webTerminal-page';

const idp = Cypress.env('BRIDGE_HTPASSWD_IDP') || 'test';
const username = Cypress.env('BRIDGE_HTPASSWD_USERNAME') || 'test';
const password = Cypress.env('BRIDGE_HTPASSWD_PASSWORD') || 'test';
const kubeAdmUserName = Cypress.env('KUBEADMIN_NAME') || 'kubeadmin';
const kubeAdmUserPass = Cypress.env('BRIDGE_KUBEADMIN_PASSWORD');

// create web terminal instance in dedicated namespace  under basic user and relogin as admin with oc client
function installDevWsAndReconfigureIdlingTimeout(dedicatedNamespace: string) {
  // we need to create an active terminal session in background before test, also
  // we rewrite default idling timeout for the terminal (because 15 min - too long change it to 1 min)
  try {
    cy.exec(`oc login -u ${username}  -p ${password} --insecure-skip-tls-verify`);
    cy.exec(`oc new-project  ${dedicatedNamespace}`);
    cy.exec(`oc apply -f testData/yamls/web-terminal/web-terminal.yaml -n ${dedicatedNamespace}`);
    cy.exec(`oc login -u ${kubeAdmUserName}  -p ${kubeAdmUserPass} --insecure-skip-tls-verify`);
  } catch (err) {
    // relogin as admin if something went wrong
    cy.exec(`oc login -u ${kubeAdmUserName}  -p ${kubeAdmUserPass} --insecure-skip-tls-verify`);
    throw err;
  }
  // override the default idling timeout from 15 minutes to 1 minute
  cy.exec(
    'oc apply -f testData/yamls/web-terminal/dev-ws-custom-idling-config.yaml -n openshift-operators',
  );
}

Given('user can see terminal icon on masthead', () => {
  checkTerminalIcon();

  webTerminalPage.verifyCloudShellBtn();
});

When('user clicks on the Web Terminal icon on the Masthead', () => {
  webTerminalPage.clickOpenCloudShellBtn();
  cy.get('cos-status-box cos-status-box--loading').should('not.exist');
});

Then('user will see the terminal window', () => {
  cy.get('.co-cloudshell-terminal__container').should('be.visible');
  // cy.wait(15000);
  webTerminalPage.verifyConnectionRediness();
});

// check  existing of web terminal in the dedicated project. Create it for the correct checking if a webterminal instance is not existed.
// It needs the web-terminal-basic.feature
Given('user has installed webTerminal in namespace {string}', (namespace: string) => {
  let devWsExistingOutput: string = '';
  cy.exec(`oc get DevWorkspace -n ${namespace}`, { failOnNonZeroExit: false })
    .then((result) => {
      devWsExistingOutput = result.stderr;
    })
    .then(() => {
      if (
        devWsExistingOutput.startsWith('No resources found') ||
        devWsExistingOutput.includes('Forbidden')
      ) {
        installDevWsAndReconfigureIdlingTimeout(namespace);
      }
    });
});

And('user has logged in as basic user', () => {
  Cypress.session.clearAllSavedSessions();
  cy.login(idp, username, password);
  // sometimes guide tour is not closed properly without delay
  cy.wait(1000);
  guidedTour.close();
});

Given('user is at developer perspective', () => {
  checkDeveloperPerspective();
  perspective.switchTo(switchPerspective.Developer);
});

Given('user is at administrator perspective', () => {
  perspective.switchTo(switchPerspective.Administrator);
});
