import * as _ from 'lodash-es';
import * as React from 'react';
import {
  Route,
  Routes,
  Navigate,
  useParams,
  useLocation,
  matchRoutes,
} from 'react-router-dom-v5-compat';
import { useActivePerspective, Perspective } from '@console/dynamic-plugin-sdk';
import { useDynamicPluginInfo } from '@console/plugin-sdk/src/api/useDynamicPluginInfo';
import { FLAGS, useUserSettings, getPerspectiveVisitedKey, usePerspectives } from '@console/shared';
import { ErrorBoundaryPage } from '@console/shared/src/components/error';
import { getReferenceForModel } from '@console/dynamic-plugin-sdk/src/utils/k8s';
import { connectToFlags } from '../reducers/connectToFlags';
import { flagPending, FlagsObject } from '../reducers/features';
import { GlobalNotifications } from './global-notifications';
import { NamespaceBar } from './namespace-bar';
import { SearchPage } from './search';
import { ResourceDetailsPage, ResourceListPage } from './resource-list';
import { AsyncComponent, LoadingBox } from './utils';
import { namespacedPrefixes } from './utils/link';
import {
  AlertmanagerModel,
  CronJobModel,
  HorizontalPodAutoscalerModel,
  VolumeSnapshotModel,
} from '../models';
import { referenceForModel } from '../module/k8s';
import { NamespaceRedirect } from './utils/namespace-redirect';
import { PageSection } from '@patternfly/react-core';
import { usePluginRoutes } from '@console/app/src/hooks/usePluginRoutes';
import CreateResource from './create-resource';
import { TelemetryNotifier } from './global-telemetry-notifications';

const RedirectComponent = () => {
  const location = useLocation();
  const to = `/k8s${location.pathname}`;
  return <Navigate to={to} replace />;
};

// Ensure a *const* function wrapper for each namespaced Component so that react router doesn't recreate them
const Memoized = new Map();
function NamespaceFromURL(Component) {
  let C = Memoized.get(Component);
  if (!C) {
    C = function NamespaceInjector(props) {
      return <Component {...props} />;
    };
    Memoized.set(Component, C);
  }
  return C;
}

const namespacedRoutes = [];
_.each(namespacedPrefixes, (p) => {
  namespacedRoutes.push({ path: `${p}/ns/:ns/*` });
  namespacedRoutes.push({ path: `${p}/all-namespaces/*` });
});

const DefaultPageRedirect: React.FC<{
  url: Perspective['properties']['landingPageURL'];
  flags: { [key: string]: boolean };
  firstVisit: boolean;
}> = ({ url, flags, firstVisit }) => {
  const [resolvedUrl, setResolvedUrl] = React.useState<string>();
  React.useEffect(() => {
    (async () => {
      setResolvedUrl((await url())(flags, firstVisit));
    })();
  }, [url, flags, firstVisit]);

  return resolvedUrl ? <Navigate to={resolvedUrl} replace /> : null;
};

type DefaultPageProps = {
  flags: FlagsObject;
};

// The default page component lets us connect to flags without connecting the entire App.
const DefaultPage_: React.FC<DefaultPageProps> = ({ flags }) => {
  const [activePerspective] = useActivePerspective();
  const perspectiveExtensions = usePerspectives();
  const [visited, setVisited, visitedLoaded] = useUserSettings<boolean>(
    getPerspectiveVisitedKey(activePerspective),
    false,
  );
  const firstVisit = React.useRef<boolean>();

  // First time thru, capture first visit status
  if (firstVisit.current == null && visitedLoaded) {
    firstVisit.current = !visited;
  }

  React.useEffect(() => {
    if (visitedLoaded && !visited) {
      // Mark perspective as visited
      setVisited(true);
    }
  }, [visitedLoaded, visited, setVisited]);

  if (Object.keys(flags).some((key) => flagPending(flags[key])) || !visitedLoaded) {
    return <LoadingBox />;
  }

  const perspective = perspectiveExtensions.find((p) => p?.properties?.id === activePerspective);

  // support redirecting to perspective landing page
  return (
    <DefaultPageRedirect
      flags={flags}
      firstVisit={firstVisit.current}
      url={perspective?.properties?.landingPageURL}
    />
  );
};

const DefaultPage = connectToFlags(
  FLAGS.OPENSHIFT,
  FLAGS.CAN_LIST_NS,
  FLAGS.MONITORING,
)(DefaultPage_);

// REDIRECT ROUTES FOR REACT-ROUTER-V6
const StatusProjectsRedirect = () => {
  const { ns } = useParams();
  return <Navigate to={`/k8s/cluster/projects/${ns}`} replace />;
};

const OverviewProjectsRedirect = () => {
  const { ns } = useParams();
  return <Navigate to={`/k8s/cluster/projects/${ns}/workloads`} replace />;
};

const AlertManagerRedirect = () => {
  const { ns, name } = useParams();
  return <Navigate to={`/k8s/ns/${ns}/${referenceForModel(AlertmanagerModel)}/${name}`} replace />;
};

const CronJobRedirect = () => {
  const { ns, name } = useParams();
  return <Navigate to={`/k8s/ns/${ns}/${CronJobModel.plural}/${name}`} replace />;
};

const HorizontalPodRedirect = () => {
  const { ns, name } = useParams();
  return <Navigate to={`/k8s/ns/${ns}/${HorizontalPodAutoscalerModel.plural}/${name}`} replace />;
};

const AppContents: React.FC<{}> = () => {
  const [, allPluginsProcessed] = useDynamicPluginInfo();
  const location = useLocation();
  const [pluginPageRoutes, inactivePluginPageRoutes] = usePluginRoutes();

  const contentRouter = (
    <Routes>
      {pluginPageRoutes}

      <Route path="/all-namespaces/*" element={<RedirectComponent />} />
      <Route path="/ns/:ns/*" element={<RedirectComponent />} />
      <Route
        path="/dashboards/*"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './dashboard/dashboards-page/dashboards' /* webpackChunkName: "dashboards" */
              ).then((m) => m.DashboardsPage)
            }
          />
        }
      />

      {/* Redirect legacy routes to avoid breaking links */}
      <Route path="/cluster-status" element={<Navigate to="/dashboards" replace />} />
      <Route path="/status/all-namespaces" element={<Navigate to="/dashboards" replace />} />
      <Route path="/status/ns/:ns" element={<StatusProjectsRedirect />} />
      <Route path="/status" element={<NamespaceRedirect />} />
      <Route path="/overview/all-namespaces" element={<Navigate to="/dashboards" replace />} />
      <Route path="/overview/ns/:ns" element={<OverviewProjectsRedirect />} />
      <Route path="/overview" element={<NamespaceRedirect />} />

      <Route
        path="/api-explorer"
        element={
          <AsyncComponent
            loader={() =>
              import('./api-explorer' /* webpackChunkName: "api-explorer" */).then(
                (m) => m.APIExplorerPage,
              )
            }
          />
        }
      />
      <Route
        path="/api-resource/cluster/:plural/*"
        element={
          <AsyncComponent
            loader={() =>
              import('./api-explorer' /* webpackChunkName: "api-explorer" */).then(
                (m) => m.APIResourcePage,
              )
            }
          />
        }
      />
      <Route
        path="/api-resource/all-namespaces/:plural/*"
        element={
          <AsyncComponent
            loader={() =>
              import('./api-explorer' /* webpackChunkName: "api-explorer" */).then((m) =>
                NamespaceFromURL(m.APIResourcePage),
              )
            }
          />
        }
      />
      <Route
        path="/api-resource/ns/:ns/:plural/*"
        element={
          <AsyncComponent
            loader={() =>
              import('./api-explorer' /* webpackChunkName: "api-explorer" */).then((m) =>
                NamespaceFromURL(m.APIResourcePage),
              )
            }
          />
        }
      />

      <Route
        path="/command-line-tools"
        element={
          <AsyncComponent
            loader={() =>
              import('./command-line-tools' /* webpackChunkName: "command-line-tools" */).then(
                (m) => m.CommandLineToolsPage,
              )
            }
          />
        }
      />

      <Route path="/operatorhub" element={<NamespaceRedirect />} />

      <Route
        path="/catalog/instantiate-template"
        element={
          <AsyncComponent
            loader={() =>
              import('./instantiate-template' /* webpackChunkName: "instantiate-template" */).then(
                (m) => m.InstantiateTemplatePage,
              )
            }
          />
        }
      />

      <Route path="/k8s/ns/:ns/alertmanagers/:name" element={<AlertManagerRedirect />} />
      <Route path="/k8s/ns/:ns/batch~v1beta1~CronJob/:name" element={<CronJobRedirect />} />
      <Route
        path="/k8s/ns/:ns/autoscaling~v2beta2~HorizontalPodAutoscaler/:name"
        element={<HorizontalPodRedirect />}
      />

      <Route
        path="/k8s/all-namespaces/events"
        element={
          <AsyncComponent
            loader={() =>
              import('./events' /* webpackChunkName: "events" */).then((m) =>
                NamespaceFromURL(m.EventStreamPage),
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/events"
        element={
          <AsyncComponent
            loader={() =>
              import('./events' /* webpackChunkName: "events" */).then((m) =>
                NamespaceFromURL(m.EventStreamPage),
              )
            }
          />
        }
      />

      <Route path="/search/all-namespaces" element={<SearchPage />} />
      <Route path="/search/ns/:ns" element={<SearchPage />} />
      <Route path="/search" element={<NamespaceRedirect />} />

      <Route
        path="/k8s/all-namespaces/import"
        element={
          <AsyncComponent
            loader={() =>
              import('./import-yaml' /* webpackChunkName: "import-yaml" */).then(
                (m) => m.ImportYamlPage,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/import/"
        element={
          <AsyncComponent
            loader={() =>
              import('./import-yaml' /* webpackChunkName: "import-yaml" */).then(
                (m) => m.ImportYamlPage,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/secrets/~new/:type"
        element={
          <AsyncComponent
            kind="Secret"
            loader={() =>
              import('./secrets/create-secret' /* webpackChunkName: "create-secret" */).then(
                (m) => m.CreateSecret,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/configmaps/~new/form"
        element={
          <AsyncComponent
            kind="ConfigMap"
            loader={() =>
              import(
                './configmaps/ConfigMapPage' /* webpackChunkName: "create-configmap-page" */
              ).then((m) => m.default)
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/configmaps/:name/form"
        element={
          <AsyncComponent
            kind="ConfigMap"
            loader={() =>
              import(
                './configmaps/ConfigMapPage' /* webpackChunkName: "edit-configmap-page" */
              ).then((m) => m.default)
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/secrets/:name/edit"
        element={
          <AsyncComponent
            kind="Secret"
            loader={() =>
              import('./secrets/create-secret' /* webpackChunkName: "create-secret" */).then(
                (m) => m.EditSecret,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/secrets/:name/edit-yaml"
        element={
          <AsyncComponent
            kind="Secret"
            loader={() => import('./create-yaml').then((m) => m.EditYAMLPage)}
          />
        }
      />

      <Route
        path="/k8s/ns/:ns/routes/~new/form"
        element={
          <AsyncComponent
            kind="Route"
            loader={() =>
              import('./routes/RoutePage' /* webpackChunkName: "create-route" */).then(
                (m) => m.RoutePage,
              )
            }
          />
        }
      />

      <Route
        path="/k8s/ns/:ns/routes/:name/form"
        element={
          <AsyncComponent
            kind="Route"
            loader={() =>
              import('./routes/RoutePage' /* webpackChunkName: "edit-route" */).then(
                (m) => m.RoutePage,
              )
            }
          />
        }
      />

      <Route
        path="/k8s/cluster/rolebindings/~new"
        element={
          <AsyncComponent
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CreateRoleBinding)
            }
            kind="RoleBinding"
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/rolebindings/~new"
        element={
          <AsyncComponent
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CreateRoleBinding)
            }
            kind="RoleBinding"
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/rolebindings/:name/copy"
        element={
          <AsyncComponent
            kind="RoleBinding"
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CopyRoleBinding)
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/rolebindings/:name/edit"
        element={
          <AsyncComponent
            kind="RoleBinding"
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.EditRoleBinding)
            }
          />
        }
      />
      <Route
        path="/k8s/cluster/clusterrolebindings/:name/copy"
        element={
          <AsyncComponent
            kind="ClusterRoleBinding"
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.CopyRoleBinding)
            }
          />
        }
      />
      <Route
        path="/k8s/cluster/clusterrolebindings/:name/edit"
        element={
          <AsyncComponent
            kind="ClusterRoleBinding"
            loader={() =>
              import('./RBAC' /* webpackChunkName: "rbac" */).then((m) => m.EditRoleBinding)
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/:plural/:name/attach-storage"
        element={
          <AsyncComponent
            loader={() =>
              import('./storage/attach-storage' /* webpackChunkName: "attach-storage" */).then(
                (m) => m.default,
              )
            }
          />
        }
      />

      <Route
        path="/k8s/ns/:ns/persistentvolumeclaims/~new/form"
        element={
          <AsyncComponent
            kind="PersistentVolumeClaim"
            loader={() =>
              import('./storage/create-pvc' /* webpackChunkName: "create-pvc" */).then(
                (m) => m.CreatePVC,
              )
            }
          />
        }
      />

      <Route
        path={`/k8s/ns/:ns/${VolumeSnapshotModel.plural}/~new/form`}
        element={
          <AsyncComponent
            loader={() =>
              import(
                '@console/app/src/components/volume-snapshot/create-volume-snapshot/create-volume-snapshot' /* webpackChunkName: "create-volume-snapshot" */
              ).then((m) => m.VolumeSnapshot)
            }
          />
        }
      />
      <Route
        path={`/k8s/all-namespaces/${VolumeSnapshotModel.plural}`}
        element={
          <Navigate
            to={`/k8s/all-namespaces/${getReferenceForModel(VolumeSnapshotModel)}`}
            replace
          />
        }
      />

      <Route
        path="/monitoring/alertmanagerconfig/receivers/~new"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './monitoring/receiver-forms/alert-manager-receiver-forms' /* webpackChunkName: "receiver-forms" */
              ).then((m) => m.CreateReceiver)
            }
          />
        }
      />
      <Route
        path="/monitoring/alertmanagerconfig/receivers/:name/edit"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './monitoring/receiver-forms/alert-manager-receiver-forms' /* webpackChunkName: "receiver-forms" */
              ).then((m) => m.EditReceiver)
            }
          />
        }
      />
      <Route
        path="/monitoring/*"
        element={
          <AsyncComponent
            loader={() =>
              import('./monitoring/alerting' /* webpackChunkName: "alerting" */).then(
                (m) => m.MonitoringUI,
              )
            }
          />
        }
      />

      <Route
        path="/settings/idp/github"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/github-idp-form' /* webpackChunkName: "github-idp-form" */
              ).then((m) => m.AddGitHubPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/gitlab"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/gitlab-idp-form' /* webpackChunkName: "gitlab-idp-form" */
              ).then((m) => m.AddGitLabPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/google"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/google-idp-form' /* webpackChunkName: "google-idp-form" */
              ).then((m) => m.AddGooglePage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/htpasswd"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/htpasswd-idp-form' /* webpackChunkName: "htpasswd-idp-form" */
              ).then((m) => m.AddHTPasswdPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/keystone"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/keystone-idp-form' /* webpackChunkName: "keystone-idp-form" */
              ).then((m) => m.AddKeystonePage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/ldap"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/ldap-idp-form' /* webpackChunkName: "ldap-idp-form" */
              ).then((m) => m.AddLDAPPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/ldap"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/ldap-idp-form' /* webpackChunkName: "ldap-idp-form" */
              ).then((m) => m.AddLDAPPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/oidconnect"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/openid-idp-form' /* webpackChunkName: "openid-idp-form" */
              ).then((m) => m.AddOpenIDIDPPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/basicauth"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/basicauth-idp-form' /* webpackChunkName: "basicauth-idp-form" */
              ).then((m) => m.AddBasicAuthPage)
            }
          />
        }
      />
      <Route
        path="/settings/idp/requestheader"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/request-header-idp-form' /* webpackChunkName: "request-header-idp-form" */
              ).then((m) => m.AddRequestHeaderPage)
            }
          />
        }
      />
      <Route
        path="/settings/cluster/*"
        element={
          <AsyncComponent
            loader={() =>
              import(
                './cluster-settings/cluster-settings' /* webpackChunkName: "cluster-settings" */
              ).then((m) => m.ClusterSettingsPage)
            }
          />
        }
      />

      <Route
        path={'/k8s/cluster/storageclasses/~new/form'}
        element={
          <AsyncComponent
            loader={() =>
              import('./storage-class-form' /* webpackChunkName: "storage-class-form" */).then(
                (m) => m.StorageClassForm,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/:resourceRef/form"
        element={
          <AsyncComponent
            kind="PodDisruptionBudgets"
            loader={() =>
              import(
                '@console/app/src/components/pdb/PDBFormPage' /* webpackChunkName: "PDBFormPage" */
              ).then((m) => m.PDBFormPage)
            }
          />
        }
      />
      <Route path="/k8s/cluster/:plural" element={<ResourceListPage />} />
      <Route path="/k8s/cluster/:plural/~new" element={<CreateResource />} />
      <Route path="/k8s/cluster/:plural/:name/*" element={<ResourceDetailsPage />} />
      <Route
        path="/k8s/ns/:ns/pods/:podName/containers/:name/debug/*"
        element={
          <AsyncComponent
            loader={() =>
              import('./debug-terminal' /* webpackChunkName: "debug-terminal" */).then(
                (m) => m.DebugTerminalPage,
              )
            }
          />
        }
      />
      <Route
        path="/k8s/ns/:ns/pods/:podName/containers/:name/*"
        element={
          <AsyncComponent
            loader={() => import('./container').then((m) => m.ContainersDetailsPage)}
          />
        }
      />
      <Route path="/k8s/ns/:ns/:plural/~new/*" element={<CreateResource />} />
      <Route path="/k8s/ns/:ns/:plural/:name/*" element={<ResourceDetailsPage />} />
      <Route path="/k8s/ns/:ns/:plural" element={<ResourceListPage />} />

      <Route path="/k8s/all-namespaces/:plural" element={<ResourceListPage />} />
      <Route path="/k8s/all-namespaces/:plural/:name/*" element={<ResourceDetailsPage />} />

      {inactivePluginPageRoutes}
      <Route path="/" element={<DefaultPage />} />

      {allPluginsProcessed ? (
        <Route
          path="*"
          element={
            <AsyncComponent
              loader={() =>
                import('./error' /* webpackChunkName: "error" */).then((m) => m.ErrorPage404)
              }
            />
          }
        />
      ) : (
        <Route element={<LoadingBox />} />
      )}
    </Routes>
  );

  const matches = matchRoutes(namespacedRoutes, location);

  return (
    <>
      <PageSection
        hasBodyWrapper={false}
        padding={{ default: 'noPadding' }}
        className="pf-v6-c-page__main-section--no-gap"
      >
        <GlobalNotifications />
        {matches && <NamespaceBar />}
      </PageSection>
      <PageSection
        isFilled={true}
        hasBodyWrapper={false}
        padding={{ default: 'noPadding' }}
        className="pf-v6-c-page__main-section--no-gap pf-v6-u-flex-shrink-1"
        id="content-scrollable"
      >
        <ErrorBoundaryPage>
          <React.Suspense fallback={<LoadingBox />}>{contentRouter}</React.Suspense>
        </ErrorBoundaryPage>
      </PageSection>
      <TelemetryNotifier />
    </>
  );
};

export default AppContents;
