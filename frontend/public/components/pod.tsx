/* eslint-disable @typescript-eslint/no-use-before-define */
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom-v5-compat';
import { sortable, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { Trans, useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { css } from '@patternfly/react-styles';
import * as _ from 'lodash-es';
import {
  Button,
  Divider,
  Popover,
  Grid,
  GridItem,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  ContentVariants,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
} from '@patternfly/react-core';
import {
  Status,
  TableColumnsType,
  LazyActionMenu,
  ActionServiceProvider,
  ActionMenu,
  ActionMenuVariant,
  useUserSettingsCompatibility,
  usePrometheusGate,
} from '@console/shared';
import { ByteDataTypes } from '@console/shared/src/graph-helper/data-utils';
import {
  COLUMN_MANAGEMENT_CONFIGMAP_KEY,
  COLUMN_MANAGEMENT_LOCAL_STORAGE_KEY,
} from '@console/shared/src/constants/common';
import { ListPageBody, RowFilter, RowProps, TableColumn } from '@console/dynamic-plugin-sdk';
import PaneBody from '@console/shared/src/components/layout/PaneBody';
import * as UIActions from '../actions/ui';
import { coFetchJSON } from '../co-fetch';
import {
  ContainerSpec,
  K8sResourceKindReference,
  PodKind,
  referenceForModel,
  referenceFor,
  Selector,
  ContainerState,
} from '../module/k8s';
import {
  getRestartPolicyLabel,
  podPhase,
  podPhaseFilterReducer,
  podReadiness,
  podRestarts,
  isWindowsPod,
  isContainerCrashLoopBackOff,
} from '../module/k8s/pods';
import {
  getContainerRestartCount,
  getContainerState,
  getContainerStatus,
} from '../module/k8s/container';
import { ResourceEventStream } from './events';
import { DetailsPage } from './factory';
import ListPageHeader from './factory/ListPage/ListPageHeader';
import ListPageFilter from './factory/ListPage/ListPageFilter';
import ListPageCreate from './factory/ListPage/ListPageCreate';
import {
  AsyncComponent,
  DetailsItem,
  Kebab,
  NodeLink,
  OwnerReferences,
  ResourceIcon,
  ResourceLink,
  ResourceSummary,
  ScrollToTopOnMount,
  SectionHeading,
  formatBytesAsMiB,
  formatCores,
  humanizeBinaryBytes,
  humanizeDecimalBytesPerSec,
  humanizeCpuCores,
  navFactory,
  units,
  LabelList,
  RuntimeClass,
} from './utils';
import { Timestamp } from '@console/shared/src/components/datetime/Timestamp';
import { PodLogs } from './pod-logs';
import {
  Area,
  Stack,
  PROMETHEUS_BASE_PATH,
  PROMETHEUS_TENANCY_BASE_PATH,
  PrometheusResult,
} from './graphs';
import { VolumesTable } from './volumes-table';
import { PodModel } from '../models';
import { Conditions } from './conditions';
import Dashboard from '@console/shared/src/components/dashboard/Dashboard';

// Key translations for oauth login templates
// t('public~Log in to your account')
// t('public~Log in')
// t('public~Welcome to {{platformTitle}}')
// t('public~Log in with {{providerName}}')
// t('public~Login is required. Please try again.')
// t('public~Could not check CSRF token. Please try again.')
// t('public~Invalid login or password. Please try again.')
import { resourcePath } from './utils/resource-link';
import { useK8sWatchResource } from './utils/k8s-watch-hook';
import { useListPageFilter } from './factory/ListPage/filter-hook';
import VirtualizedTable, { TableData } from './factory/Table/VirtualizedTable';
import { sortResourceByValue } from './factory/Table/sort';
import { useActiveColumns } from './factory/Table/active-columns-hook';
import { PodDisruptionBudgetField } from '@console/app/src/components/pdb/PodDisruptionBudgetField';
import { PodTraffic } from './pod-traffic';
import { RootState } from '../redux';
// Only request metrics if the device's screen width is larger than the
// breakpoint where metrics are visible.
const showMetrics =
  PROMETHEUS_BASE_PATH && PROMETHEUS_TENANCY_BASE_PATH && window.screen.width >= 1200;

const fetchPodMetrics = (namespace: string): Promise<UIActions.PodMetrics> => {
  const metrics = [
    {
      key: 'memory',
      query: namespace
        ? `sum(container_memory_working_set_bytes{namespace='${namespace}',container=''}) BY (pod, namespace)`
        : "sum(container_memory_working_set_bytes{container=''}) BY (pod, namespace)",
    },
    {
      key: 'cpu',
      query: namespace
        ? `pod:container_cpu_usage:sum{namespace='${namespace}'}`
        : 'pod:container_cpu_usage:sum',
    },
  ];
  const promises = metrics.map(
    ({ key, query }): Promise<UIActions.PodMetrics> => {
      const url = namespace
        ? `${PROMETHEUS_TENANCY_BASE_PATH}/api/v1/query?namespace=${namespace}&query=${query}`
        : `${PROMETHEUS_BASE_PATH}/api/v1/query?query=${query}`;
      return coFetchJSON(url).then(({ data: { result } }) => {
        return result.reduce((acc, data) => {
          const value = Number(data.value[1]);
          return _.set(acc, [key, data.metric.namespace, data.metric.pod], value);
        }, {});
      });
    },
  );
  return Promise.all(promises).then((data: any[]) => _.assign({}, ...data));
};

export const menuActions = [
  ...Kebab.getExtensionsActionsForKind(PodModel),
  ...Kebab.factory.common,
];

// t('public~Name')
// t('public~Namespace')
// t('public~Status')
// t('public~Ready')
// t('public~Restarts')
// t('public~Owner')
// t('public~Node')
// t('public~Memory')
// t('public~CPU')
// t('public~Created')
// t('public~Labels')
// t('public~IP address')

const podColumnInfo = Object.freeze({
  name: {
    classes: '',
    id: 'name',
    title: 'public~Name',
  },
  namespace: {
    classes: '',
    id: 'namespace',
    title: 'public~Namespace',
  },
  status: {
    classes: '',
    id: 'status',
    title: 'public~Status',
  },
  ready: {
    classes: css('pf-m-nowrap', 'pf-v6-u-w-10-on-lg', 'pf-v6-u-w-8-on-xl'),
    id: 'ready',
    title: 'public~Ready',
  },
  restarts: {
    classes: css('pf-m-nowrap', 'pf-v6-u-w-8-on-2xl'),
    id: 'restarts',
    title: 'public~Restarts',
  },
  owner: {
    classes: '',
    id: 'owner',
    title: 'public~Owner',
  },
  node: {
    classes: '',
    id: 'node',
    title: 'public~Node',
  },
  memory: {
    classes: css({ 'pf-v6-u-w-10-on-2xl': showMetrics }),
    id: 'memory',
    title: 'public~Memory',
  },
  cpu: {
    classes: css({ 'pf-v6-u-w-10-on-2xl': showMetrics }),
    id: 'cpu',
    title: 'public~CPU',
  },
  created: {
    classes: css('pf-v6-u-w-10-on-2xl'),
    id: 'created',
    title: 'public~Created',
  },
  labels: {
    classes: '',
    id: 'labels',
    title: 'public~Labels',
  },
  ipaddress: {
    classes: '',
    id: 'ipaddress',
    title: 'public~IP address',
  },
  traffic: {
    classes: '',
    id: 'trafficStatus',
    title: 'public~Receiving Traffic',
  },
});

const kind = 'Pod';
const columnManagementID = referenceForModel(PodModel);

const getColumns = (showNodes: boolean, t: TFunction): TableColumn<PodKind>[] => [
  {
    title: t(podColumnInfo.name.title),
    id: podColumnInfo.name.id,
    sort: 'metadata.name',
    transforms: [sortable],
    props: { className: podColumnInfo.name.classes },
  },
  {
    title: t(podColumnInfo.namespace.title),
    id: podColumnInfo.namespace.id,
    sort: 'metadata.namespace',
    transforms: [sortable],
    props: { className: podColumnInfo.namespace.classes },
  },
  {
    title: t(podColumnInfo.status.title),
    id: podColumnInfo.status.id,
    sort: (data, direction) => data.sort(sortResourceByValue<PodKind>(direction, podPhase)),
    transforms: [sortable],
    props: { className: podColumnInfo.status.classes },
  },
  {
    title: t(podColumnInfo.ready.title),
    id: podColumnInfo.ready.id,
    sort: (data, direction) =>
      data.sort(sortResourceByValue<PodKind>(direction, (obj) => podReadiness(obj).readyCount)),
    transforms: [sortable],
    props: { className: podColumnInfo.ready.classes },
  },
  {
    title: t(podColumnInfo.restarts.title),
    id: podColumnInfo.restarts.id,
    sort: (data, direction) => data.sort(sortResourceByValue<PodKind>(direction, podRestarts)),
    transforms: [sortable],
    props: { className: podColumnInfo.restarts.classes },
  },
  {
    title: showNodes ? t(podColumnInfo.node.title) : t(podColumnInfo.owner.title),
    id: podColumnInfo.owner.id,
    sort: showNodes ? 'spec.nodeName' : 'metadata.ownerReferences[0].name',
    transforms: [sortable],
    props: { className: podColumnInfo.owner.classes },
  },
  {
    title: t(podColumnInfo.memory.title),
    id: podColumnInfo.memory.id,
    sort: (data, direction) =>
      data.sort(
        sortResourceByValue<PodKind>(direction, (obj) => UIActions.getPodMetric(obj, 'memory')),
      ),
    transforms: [sortable],
    props: { className: podColumnInfo.memory.classes },
  },
  {
    title: t(podColumnInfo.cpu.title),
    id: podColumnInfo.cpu.id,
    sort: (data, direction) =>
      data.sort(
        sortResourceByValue<PodKind>(direction, (obj) => UIActions.getPodMetric(obj, 'cpu')),
      ),
    transforms: [sortable],
    props: { className: podColumnInfo.cpu.classes },
  },
  {
    title: t(podColumnInfo.created.title),
    id: podColumnInfo.created.id,
    sort: 'metadata.creationTimestamp',
    transforms: [sortable],
    props: { className: podColumnInfo.created.classes },
  },
  {
    title: t(podColumnInfo.node.title),
    id: podColumnInfo.node.id,
    sort: 'spec.nodeName',
    transforms: [sortable],
    props: { className: podColumnInfo.node.classes },
    additional: true,
  },
  {
    title: t(podColumnInfo.labels.title),
    id: podColumnInfo.labels.id,
    sort: 'metadata.labels',
    transforms: [sortable],
    props: { className: podColumnInfo.labels.classes },
    additional: true,
  },
  {
    title: t(podColumnInfo.ipaddress.title),
    id: podColumnInfo.ipaddress.id,
    sort: 'status.podIP',
    transforms: [sortable],
    props: { className: podColumnInfo.ipaddress.classes },
    additional: true,
  },
  {
    title: t(podColumnInfo.traffic.title),
    id: podColumnInfo.traffic.id,
    props: { className: podColumnInfo.traffic.classes },
    additional: true,
  },
  {
    title: '',
    id: '',
    props: { className: Kebab.columnClass },
  },
];

const PodTableRow: React.FC<RowProps<PodKind, PodRowData>> = ({
  obj: pod,
  rowData: { showNodes },
  activeColumnIDs,
}) => {
  const { t } = useTranslation();
  const { name, namespace, creationTimestamp, labels } = pod.metadata;
  const bytes = useSelector<RootState, number>(({ UI }) => {
    const metrics = UI.getIn(['metrics', 'pod']);
    return metrics?.memory?.[namespace]?.[name];
  });
  const cores = useSelector<RootState, number>(({ UI }) => {
    const metrics = UI.getIn(['metrics', 'pod']);
    return metrics?.cpu?.[namespace]?.[name];
  });
  const { readyCount, totalContainers } = podReadiness(pod);
  const phase = podPhase(pod);
  const restarts = podRestarts(pod);
  const resourceKind = referenceFor(pod);
  const context = { [resourceKind]: pod };
  return (
    <>
      <TableData
        className={podColumnInfo.name.classes}
        id={podColumnInfo.name.id}
        activeColumnIDs={activeColumnIDs}
      >
        <ResourceLink kind={kind} name={name} namespace={namespace} />
      </TableData>
      <TableData
        className={css(podColumnInfo.namespace.classes, 'co-break-word')}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.namespace.id}
      >
        <ResourceLink kind="Namespace" name={namespace} />
      </TableData>
      <TableData
        className={podColumnInfo.status.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.status.id}
      >
        <PodStatus pod={pod} />
      </TableData>
      <TableData
        className={podColumnInfo.ready.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.ready.id}
      >
        {readyCount}/{totalContainers}
      </TableData>
      <TableData
        className={podColumnInfo.restarts.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.restarts.id}
      >
        {restarts}
      </TableData>
      <TableData
        className={podColumnInfo.owner.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.owner.id}
      >
        {showNodes ? (
          <ResourceLink kind="Node" name={pod.spec.nodeName} namespace={namespace} />
        ) : (
          <OwnerReferences resource={pod} />
        )}
      </TableData>
      <TableData
        className={podColumnInfo.memory.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.memory.id}
      >
        {bytes ? `${formatBytesAsMiB(bytes)} MiB` : '-'}
      </TableData>
      <TableData
        className={podColumnInfo.cpu.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.cpu.id}
      >
        {cores ? t('public~{{numCores}} cores', { numCores: formatCores(cores) }) : '-'}
      </TableData>
      <TableData
        className={podColumnInfo.created.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.created.id}
      >
        <Timestamp timestamp={creationTimestamp} />
      </TableData>
      <TableData
        className={podColumnInfo.node.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.node.id}
      >
        <ResourceLink kind="Node" name={pod.spec.nodeName} namespace={namespace} />
      </TableData>
      <TableData
        className={podColumnInfo.labels.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.labels.id}
      >
        <LabelList kind={kind} labels={labels} />
      </TableData>
      <TableData
        className={podColumnInfo.ipaddress.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.ipaddress.id}
      >
        {pod?.status?.podIP ?? '-'}
      </TableData>
      <TableData
        className={podColumnInfo.traffic.classes}
        activeColumnIDs={activeColumnIDs}
        id={podColumnInfo.traffic.id}
      >
        <PodTraffic podName={name} namespace={namespace} />
      </TableData>
      <TableData className={Kebab.columnClass} activeColumnIDs={activeColumnIDs} id="">
        <LazyActionMenu context={context} isDisabled={phase === 'Terminating'} />
      </TableData>
    </>
  );
};
PodTableRow.displayName = 'PodTableRow';

export const ContainerLink: React.FC<ContainerLinkProps> = ({ pod, name }) => (
  <span className="co-resource-item co-resource-item--inline">
    <ResourceIcon kind="Container" />
    <Link to={`/k8s/ns/${pod.metadata.namespace}/pods/${pod.metadata.name}/containers/${name}`}>
      {name}
    </Link>
  </span>
);
ContainerLink.displayName = 'ContainerLink';

const ContainerRunningSince: React.FC<ContainerRunningSinceProps> = ({ startedAt }) => {
  const { t } = useTranslation();
  return startedAt ? (
    <Trans t={t} ns="public">
      since <Timestamp timestamp={startedAt} simple />
    </Trans>
  ) : null;
};

const ContainerTerminatedAt: React.FC<ContainerTerminatedAtProps> = ({ finishedAt }) => {
  const { t } = useTranslation();
  return finishedAt ? (
    <Trans t={t} ns="public">
      at <Timestamp timestamp={finishedAt} simple />{' '}
    </Trans>
  ) : null;
};

const ContainerTerminatedExitCode: React.FC<ContainerTerminatedExitCodeProps> = ({ exitCode }) => {
  const { t } = useTranslation();
  return exitCode ? t('public~with exit code {{exitCode}} ', { exitCode }) : null;
};

const ContainerTerminatedReason: React.FC<ContainerTerminatedReasonProps> = ({ reason }) => {
  const { t } = useTranslation();
  return reason ? t('public~({{reason}})', { reason }) : null;
};

export const ContainerLastState: React.FC<ContainerLastStateProps> = ({ containerLastState }) => {
  const { t } = useTranslation();
  if (containerLastState?.waiting) {
    return t('public~Waiting {{reason}}', { reason: containerLastState.waiting?.reason });
  } else if (containerLastState?.running) {
    return (
      <Trans t={t} ns="public">
        Running <ContainerRunningSince startedAt={containerLastState.running?.startedAt} />
      </Trans>
    );
  } else if (containerLastState?.terminated) {
    return (
      <Trans t={t} ns="public">
        Terminated <ContainerTerminatedAt finishedAt={containerLastState.terminated?.finishedAt} />
        <ContainerTerminatedExitCode exitCode={containerLastState.terminated?.exitCode} />
        <ContainerTerminatedReason reason={containerLastState.terminated?.reason} />
      </Trans>
    );
  }
  return <>-</>;
};

export const ContainerRow: React.FC<ContainerRowProps> = ({ pod, container }) => {
  const cstatus = getContainerStatus(pod, container.name);
  const cstate = getContainerState(cstatus);
  const startedAt = _.get(cstate, 'startedAt');
  const finishedAt = _.get(cstate, 'finishedAt');

  return (
    <Tr>
      <Td width={20}>
        <ContainerLink pod={pod} name={container.name} />
      </Td>
      <Td className="co-select-to-copy" modifier="truncate">
        {container.image || '-'}
      </Td>
      <Td visibility={['hidden', 'visibleOnMd']}>
        <Status status={cstate.label} />
      </Td>
      <Td visibility={['hidden', 'visibleOnXl']}>
        <ContainerLastState containerLastState={cstatus?.lastState} />
      </Td>
      <Td visibility={['hidden', 'visibleOnLg']}>{getContainerRestartCount(cstatus)}</Td>
      <Td width={10} visibility={['hidden', 'visibleOnLg']}>
        <Timestamp timestamp={startedAt} />
      </Td>
      <Td width={10} visibility={['hidden', 'visibleOnXl']}>
        <Timestamp timestamp={finishedAt} />
      </Td>
      <Td visibility={['hidden', 'visibleOnXl']}>{_.get(cstate, 'exitCode', '-')}</Td>
    </Tr>
  );
};
ContainerRow.displayName = 'ContainerRow';

export const PodContainerTable: React.FC<PodContainerTableProps> = ({
  heading,
  containers,
  pod,
}) => {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeading text={heading} />
      <Table gridBreakPoint="">
        <Thead>
          <Tr>
            <Th width={20}>{t('public~Name')}</Th>
            <Th>{t('public~Image')}</Th>
            <Th visibility={['hidden', 'visibleOnMd']}>{t('public~State')}</Th>
            <Th visibility={['hidden', 'visibleOnXl']}>{t('public~Last State')}</Th>
            <Th visibility={['hidden', 'visibleOnLg']}>{t('public~Restarts')}</Th>
            <Th width={10} visibility={['hidden', 'visibleOnLg']}>
              {t('public~Started')}
            </Th>
            <Th width={10} visibility={['hidden', 'visibleOnXl']}>
              {t('public~Finished')}
            </Th>
            <Th visibility={['hidden', 'visibleOnXl']}>{t('public~Exit code')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {containers.map((c: any, i: number) => (
            <ContainerRow key={i} pod={pod} container={c} />
          ))}
        </Tbody>
      </Table>
    </>
  );
};

const getNetworkName = (result: PrometheusResult) =>
  // eslint-disable-next-line camelcase
  result?.metric?.network_name || 'unnamed interface';

// TODO update to use QueryBrowser for each graph
const PodMetrics: React.FC<PodMetricsProps> = ({ obj }) => {
  const { t } = useTranslation();
  return (
    <Dashboard className="resource-metrics-dashboard">
      <Grid hasGutter>
        <GridItem xl={6} lg={12}>
          <Card className="resource-metrics-dashboard__card">
            <CardHeader>
              <CardTitle>{t('public~Memory usage')}</CardTitle>
            </CardHeader>
            <CardBody className="resource-metrics-dashboard__card-body">
              <Area
                ariaChartLinkLabel={t('public~View in query browser')}
                humanize={humanizeBinaryBytes}
                byteDataType={ByteDataTypes.BinaryBytes}
                namespace={obj.metadata.namespace}
                query={`sum(container_memory_working_set_bytes{pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}',container='',}) BY (pod, namespace)`}
                limitQuery={`sum(kube_pod_resource_limit{resource='memory',pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'})`}
                requestedQuery={`sum(kube_pod_resource_request{resource='memory',pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'}) BY (pod, namespace)`}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem xl={6} lg={12}>
          <Card className="resource-metrics-dashboard__card">
            <CardHeader>
              <CardTitle>{t('public~CPU usage')}</CardTitle>
            </CardHeader>
            <CardBody className="resource-metrics-dashboard__card-body">
              <Area
                ariaChartLinkLabel={t('public~View in query browser')}
                humanize={humanizeCpuCores}
                namespace={obj.metadata.namespace}
                query={`pod:container_cpu_usage:sum{pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'}`}
                limitQuery={`sum(kube_pod_resource_limit{resource='cpu',pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'})`}
                requestedQuery={`sum(kube_pod_resource_request{resource='cpu',pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'}) BY (pod, namespace)`}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem xl={6} lg={12}>
          <Card className="resource-metrics-dashboard__card">
            <CardHeader>
              <CardTitle>{t('public~Filesystem')}</CardTitle>
            </CardHeader>
            <CardBody className="resource-metrics-dashboard__card-body">
              <Area
                ariaChartLinkLabel={t('public~View in query browser')}
                humanize={humanizeBinaryBytes}
                byteDataType={ByteDataTypes.BinaryBytes}
                namespace={obj.metadata.namespace}
                query={`pod:container_fs_usage_bytes:sum{pod='${obj.metadata.name}',namespace='${obj.metadata.namespace}'}`}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem xl={6} lg={12}>
          <Card className="resource-metrics-dashboard__card">
            <CardHeader>
              <CardTitle>{t('public~Network in')}</CardTitle>
            </CardHeader>
            <CardBody className="resource-metrics-dashboard__card-body">
              <Stack
                ariaChartLinkLabel={t('public~View in query browser')}
                humanize={humanizeDecimalBytesPerSec}
                namespace={obj.metadata.namespace}
                query={`pod_interface_network:container_network_receive_bytes:irate5m{pod='${obj.metadata.name}', namespace='${obj.metadata.namespace}'}`}
                description={getNetworkName}
              />
            </CardBody>
          </Card>
        </GridItem>
        <GridItem xl={6} lg={12}>
          <Card className="resource-metrics-dashboard__card">
            <CardHeader>
              <CardTitle>{t('public~Network out')}</CardTitle>
            </CardHeader>
            <CardBody className="resource-metrics-dashboard__card-body">
              <Stack
                ariaChartLinkLabel={t('public~View in query browser')}
                humanize={humanizeDecimalBytesPerSec}
                namespace={obj.metadata.namespace}
                query={`pod_interface_network:container_network_transmit_bytes_total:irate5m{pod='${obj.metadata.name}', namespace='${obj.metadata.namespace}'}`}
                description={getNetworkName}
              />
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    </Dashboard>
  );
};

const PodStatusPopover: React.FC<PodStatusPopoverProps> = ({
  bodyContent,
  headerContent,
  footerContent,
  status,
}) => {
  return (
    <Popover headerContent={headerContent} bodyContent={bodyContent} footerContent={footerContent}>
      <Button variant="link" isInline data-test="popover-status-button">
        <Status status={status} />
      </Button>
    </Popover>
  );
};

export const PodStatus: React.FC<PodStatusProps> = ({ pod }) => {
  const status = podPhase(pod);
  const unschedulableCondition = pod.status?.conditions?.find(
    (condition) => condition.reason === 'Unschedulable' && condition.status === 'False',
  );
  const containerStatusStateWaiting = pod.status?.containerStatuses?.find(
    (cs) => cs.state?.waiting,
  );
  const { t } = useTranslation();

  if (status === 'Pending' && unschedulableCondition) {
    return (
      <PodStatusPopover
        bodyContent={unschedulableCondition.message}
        headerContent={t('public~Pod unschedulable')}
        status={status}
      />
    );
  }
  if (
    (status === 'CrashLoopBackOff' || status === 'ErrImagePull' || status === 'ImagePullBackOff') &&
    containerStatusStateWaiting
  ) {
    let footerLinks: React.ReactNode;
    let headerTitle = '';
    if (status === 'CrashLoopBackOff') {
      headerTitle = t('public~Pod crash loop back-off');
      const containers: ContainerSpec[] = pod.spec.containers;
      footerLinks = (
        <Content>
          <Content component={ContentVariants.p}>
            {t(
              'public~CrashLoopBackOff indicates that the application within the container is failing to start properly.',
            )}
          </Content>
          <Content component={ContentVariants.p}>
            {t('public~To troubleshoot, view logs and events, then debug in terminal.')}
          </Content>
          <Content component={ContentVariants.p}>
            <Link to={`${resourcePath('Pod', pod.metadata.name, pod.metadata.namespace)}/logs`}>
              {t('public~View logs')}
            </Link>
            &emsp;
            <Link to={`${resourcePath('Pod', pod.metadata.name, pod.metadata.namespace)}/events`}>
              {t('public~View events')}
            </Link>
          </Content>
          <Divider />
          {containers.map((container) => {
            if (isContainerCrashLoopBackOff(pod, container.name) && !isWindowsPod(pod)) {
              return (
                <div key={container.name}>
                  <Link
                    to={`${resourcePath(
                      'Pod',
                      pod.metadata.name,
                      pod.metadata.namespace,
                    )}/containers/${container.name}/debug`}
                    data-test={`popup-debug-container-link-${container.name}`}
                  >
                    {t('public~Debug container {{name}}', { name: container.name })}
                  </Link>
                </div>
              );
            }
          })}
        </Content>
      );
    }

    return (
      <PodStatusPopover
        headerContent={headerTitle}
        bodyContent={containerStatusStateWaiting.state.waiting.message}
        footerContent={footerLinks}
        status={status}
      />
    );
  }

  return <Status status={status} />;
};

export const PodDetailsList: React.FC<PodDetailsListProps> = ({ pod }) => {
  const { t } = useTranslation();
  const moreThanOnePodIPs = pod.status?.podIPs?.length > 1;
  const moreThanOneHostIPs = pod.status?.hostIPs?.length > 1;
  return (
    <DescriptionList>
      <DescriptionListGroup>
        <DescriptionListTerm>{t('public~Status')}</DescriptionListTerm>
        <DescriptionListDescription>
          <PodStatus pod={pod} />
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DetailsItem label={t('public~Restart policy')} obj={pod} path="spec.restartPolicy">
        {getRestartPolicyLabel(pod)}
      </DetailsItem>
      <DetailsItem
        label={t('public~Active deadline seconds')}
        obj={pod}
        path="spec.activeDeadlineSeconds"
      >
        {pod.spec.activeDeadlineSeconds
          ? t('public~{{count}} second', { count: pod.spec.activeDeadlineSeconds })
          : t('public~Not configured')}
      </DetailsItem>
      <DetailsItem
        label={moreThanOnePodIPs ? t('public~Pod IPs') : t('public~Pod IP')}
        obj={pod}
        path={moreThanOnePodIPs ? 'status.podIPs' : 'status.podIP'}
      >
        {moreThanOnePodIPs
          ? pod.status.podIPs.map((podIP) => podIP.ip).join(', ')
          : pod.status.podIP}
      </DetailsItem>
      <DetailsItem
        label={moreThanOneHostIPs ? t('public~Host IPs') : t('public~Host IP')}
        obj={pod}
        path={moreThanOneHostIPs ? 'status.hostIPs' : 'status.hostIP'}
      >
        {moreThanOneHostIPs
          ? pod.status.hostIPs.map((hostIP) => hostIP.ip).join(', ')
          : pod.status.hostIP}
      </DetailsItem>
      <DetailsItem label={t('public~Node')} obj={pod} path="spec.nodeName" hideEmpty>
        <NodeLink name={pod.spec.nodeName} />
      </DetailsItem>
      {pod.spec.imagePullSecrets && (
        <DetailsItem label={t('public~Image pull secret')} obj={pod} path="spec.imagePullSecrets">
          {pod.spec.imagePullSecrets.map((imagePullSecret) => (
            <ResourceLink
              key={imagePullSecret.name}
              kind="Secret"
              name={imagePullSecret.name}
              namespace={pod.metadata.namespace}
            />
          ))}
        </DetailsItem>
      )}
      <RuntimeClass obj={pod} path="spec.runtimeClassName" />
      <PodDisruptionBudgetField obj={pod} />
      <DetailsItem label={t('public~Receiving Traffic')} obj={pod}>
        <PodTraffic podName={pod.metadata.name} namespace={pod.metadata.namespace} />
      </DetailsItem>
    </DescriptionList>
  );
};
PodDetailsList.displayName = 'PodDetailsList';

export const PodResourceSummary: React.FC<PodResourceSummaryProps> = ({ pod }) => (
  <ResourceSummary
    resource={pod}
    showNodeSelector
    nodeSelector="spec.nodeSelector"
    showTolerations
  />
);

const Details: React.FC<PodDetailsProps> = ({ obj: pod }) => {
  const limits = {
    cpu: null,
    memory: null,
  };
  limits.cpu = _.reduce(
    pod.spec.containers,
    (sum, container) => {
      const value = units.dehumanize(_.get(container, 'resources.limits.cpu', 0), 'numeric').value;
      return sum + value;
    },
    0,
  );
  limits.memory = _.reduce(
    pod.spec.containers,
    (sum, container) => {
      const value = units.dehumanize(
        _.get(container, 'resources.limits.memory', 0),
        'binaryBytesWithoutB',
      ).value;
      return sum + value;
    },
    0,
  );
  const { t } = useTranslation();
  return (
    <>
      <ScrollToTopOnMount />
      <PaneBody>
        <SectionHeading text={t('public~Pod details')} />
        <Grid hasGutter>
          <GridItem sm={6}>
            <PodResourceSummary pod={pod} />
          </GridItem>
          <GridItem sm={6}>
            <PodDetailsList pod={pod} />
          </GridItem>
        </Grid>
      </PaneBody>
      {pod.spec.initContainers && (
        <PaneBody>
          <PodContainerTable
            key="initContainerTable"
            heading={t('public~Init containers')}
            containers={pod.spec.initContainers}
            pod={pod}
          />
        </PaneBody>
      )}
      <PaneBody>
        <PodContainerTable
          key="containerTable"
          heading={t('public~Containers')}
          containers={pod.spec.containers}
          pod={pod}
        />
      </PaneBody>
      <PaneBody>
        <VolumesTable resource={pod} heading={t('public~Volumes')} />
      </PaneBody>
      <PaneBody>
        <SectionHeading text={t('public~Conditions')} />
        <Conditions conditions={pod.status.conditions} />
      </PaneBody>
    </>
  );
};

const EnvironmentPage = (props: any) => (
  <AsyncComponent
    loader={() => import('./environment.jsx').then((c) => c.EnvironmentPage)}
    {...props}
  />
);

const envPath = ['spec', 'containers'];
const PodEnvironmentComponent = (props) => (
  <EnvironmentPage obj={props.obj} rawEnvData={props.obj.spec} envPath={envPath} readOnly={true} />
);

export const PodConnectLoader: React.FC<PodConnectLoaderProps> = ({
  obj,
  message,
  initialContainer,
  infoMessage,
  attach = false,
}) => (
  <PaneBody>
    <Grid>
      <GridItem>
        <div className="panel-body">
          <AsyncComponent
            loader={() => import('./pod-connect').then((c) => c.PodConnect)}
            obj={obj}
            message={message}
            infoMessage={infoMessage}
            initialContainer={initialContainer}
            attach={attach}
          />
        </div>
      </GridItem>
    </Grid>
  </PaneBody>
);
export const PodsDetailsPage: React.FC<PodDetailsPageProps> = (props) => {
  const prometheusIsAvailable = usePrometheusGate();
  const customActionMenu = (kindObj, obj) => {
    const resourceKind = referenceForModel(kindObj);
    const context = { [resourceKind]: obj };
    return (
      <ActionServiceProvider context={context}>
        {({ actions, options, loaded }) =>
          loaded && (
            <ActionMenu actions={actions} options={options} variant={ActionMenuVariant.DROPDOWN} />
          )
        }
      </ActionServiceProvider>
    );
  };
  return (
    <DetailsPage
      {...props}
      getResourceStatus={podPhase}
      customActionMenu={customActionMenu}
      pages={[
        navFactory.details(Details),
        ...(prometheusIsAvailable ? [navFactory.metrics(PodMetrics)] : []),
        navFactory.editYaml(),
        navFactory.envEditor(PodEnvironmentComponent),
        navFactory.logs(PodLogs),
        navFactory.events(ResourceEventStream),
        navFactory.terminal(PodConnectLoader),
      ]}
    />
  );
};
PodsDetailsPage.displayName = 'PodsDetailsPage';

export const PodList: React.FC<PodListProps> = ({ showNamespaceOverride, showNodes, ...props }) => {
  const { t } = useTranslation();
  const columns = React.useMemo(() => getColumns(showNodes, t), [showNodes, t]);
  const [activeColumns, userSettingsLoaded] = useActiveColumns({
    columns,
    showNamespaceOverride,
    columnManagementID,
  });
  const rowData = React.useMemo<PodRowData>(
    () => ({
      showNodes,
    }),
    [showNodes],
  );
  return (
    userSettingsLoaded && (
      <VirtualizedTable<PodKind, PodRowData>
        {...props}
        aria-label={t('public~Pods')}
        label={t('public~Pods')}
        columns={activeColumns}
        Row={PodTableRow}
        rowData={rowData}
      />
    )
  );
};
PodList.displayName = 'PodList';

export const getFilters = (t: TFunction): RowFilter<PodKind>[] => [
  {
    filterGroupName: t('public~Status'),
    type: 'pod-status',
    filter: (phases, pod) => {
      if (!phases || !phases.selected || !phases.selected.length) {
        return true;
      }
      const phase = podPhaseFilterReducer(pod);
      return phases.selected.includes(phase) || !_.includes(phases.all, phase);
    },
    reducer: podPhaseFilterReducer,
    items: [
      { id: 'Running', title: t('public~Running') },
      { id: 'Pending', title: t('public~Pending') },
      { id: 'Terminating', title: t('public~Terminating') },
      { id: 'CrashLoopBackOff', title: t('public~CrashLoopBackOff') },
      // Use title "Completed" to match what appears in the status column for the pod.
      // The pod phase is "Succeeded," but the container state is "Completed."
      { id: 'Succeeded', title: t('public~Completed') },
      { id: 'Failed', title: t('public~Failed') },
      { id: 'Unknown', title: t('public~Unknown') },
    ],
  },
];

export const PodsPage: React.FC<PodPageProps> = ({
  canCreate = true,
  namespace,
  showNodes,
  showTitle = true,
  selector,
  fieldSelector,
  hideNameLabelFilters,
  hideLabelFilter,
  hideColumnManagement,
  nameFilter,
  showNamespaceOverride,
  mock = false,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [tableColumns, , userSettingsLoaded] = useUserSettingsCompatibility<TableColumnsType>(
    COLUMN_MANAGEMENT_CONFIGMAP_KEY,
    COLUMN_MANAGEMENT_LOCAL_STORAGE_KEY,
    undefined,
    true,
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(() => {
    if (showMetrics) {
      const updateMetrics = () =>
        fetchPodMetrics(namespace)
          .then((result) => dispatch(UIActions.setPodMetrics(result)))
          .catch((e) => {
            // Just log the error here. Showing a warning alert could be more annoying
            // than helpful. It should be obvious there are no metrics in the list, and
            // if monitoring is broken, it'll be really apparent since none of the
            // graphs and dashboards will load in the UI.
            // eslint-disable-next-line no-console
            console.error('Unable to fetch pod metrics', e);
          });
      updateMetrics();
      const id = setInterval(updateMetrics, 30 * 1000);
      return () => clearInterval(id);
    }
  }, [namespace]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const [pods, loaded, loadError] = useK8sWatchResource<PodKind[]>({
    kind,
    isList: true,
    namespaced: true,
    namespace,
    selector,
    fieldSelector,
  });

  const filters = React.useMemo(() => getFilters(t), [t]);

  const [data, filteredData, onFilterChange] = useListPageFilter(pods, filters, {
    name: { selected: [nameFilter] },
  });
  const resourceKind = referenceForModel(PodModel);
  const accessReview = {
    groupVersionKind: resourceKind,
    namespace: namespace || 'default',
  };
  return (
    userSettingsLoaded && (
      <>
        <ListPageHeader title={showTitle ? t('public~Pods') : undefined}>
          {canCreate && (
            <ListPageCreate groupVersionKind={resourceKind} createAccessReview={accessReview}>
              {t('public~Create Pod')}
            </ListPageCreate>
          )}
        </ListPageHeader>
        <ListPageBody>
          <ListPageFilter
            data={data}
            loaded={loaded}
            rowFilters={filters}
            onFilterChange={onFilterChange}
            columnLayout={{
              columns: getColumns(showNodes, t).map((column) =>
                _.pick(column, ['title', 'additional', 'id']),
              ),
              id: columnManagementID,
              selectedColumns:
                tableColumns?.[columnManagementID]?.length > 0
                  ? new Set(tableColumns[columnManagementID])
                  : null,
              showNamespaceOverride,
              type: t('public~Pod'),
            }}
            hideNameLabelFilters={hideNameLabelFilters}
            hideLabelFilter={hideLabelFilter}
            hideColumnManagement={hideColumnManagement}
          />
          <PodList
            data={filteredData}
            unfilteredData={pods}
            loaded={loaded}
            loadError={loadError}
            showNamespaceOverride={showNamespaceOverride}
            showNodes={showNodes}
            namespace={namespace}
            mock={mock}
          />
        </ListPageBody>
      </>
    )
  );
};

type ContainerLinkProps = {
  pod: PodKind;
  name: string;
};

type ContainerRunningSinceProps = {
  startedAt?: string | number | Date;
};

type ContainerTerminatedAtProps = {
  finishedAt?: string | number | Date;
};

type ContainerTerminatedExitCodeProps = {
  exitCode?: string;
};

type ContainerTerminatedReasonProps = {
  reason?: string;
};

type ContainerLastStateProps = {
  containerLastState?: ContainerState;
};

type ContainerRowProps = {
  pod: PodKind;
  container: ContainerSpec;
};

type PodContainerTableProps = {
  heading: string;
  containers: ContainerSpec[];
  pod: PodKind;
};

type PodMetricsProps = {
  obj: PodKind;
};

type PodStatusPopoverProps = {
  bodyContent: string;
  headerContent?: string;
  footerContent?: React.ReactNode | string;
  status: string;
};

export type PodStatusProps = {
  pod: PodKind;
};

type PodResourceSummaryProps = {
  pod: PodKind;
};

export type PodDetailsListProps = {
  pod: PodKind;
};

type PodConnectLoaderProps = {
  obj: PodKind;
  message?: React.ReactElement;
  infoMessage?: React.ReactElement;
  initialContainer?: string;
  attach?: boolean;
};

type PodDetailsProps = {
  obj: PodKind;
};

type PodRowData = {
  showNodes?: boolean;
};

type PodListProps = {
  data: PodKind[];
  unfilteredData: PodKind[];
  loaded: boolean;
  loadError: any;
  showNodes?: boolean;
  showNamespaceOverride?: boolean;
  namespace?: string;
  mock?: boolean;
};

type PodPageProps = {
  canCreate?: boolean;
  fieldSelector?: string;
  namespace?: string;
  selector?: Selector;
  showTitle?: boolean;
  showNodes?: boolean;
  hideLabelFilter?: boolean;
  hideNameLabelFilters?: boolean;
  hideColumnManagement?: boolean;
  nameFilter?: string;
  showNamespaceOverride?: boolean;
  mock?: boolean;
};

type PodDetailsPageProps = {
  kind: K8sResourceKindReference;
};
