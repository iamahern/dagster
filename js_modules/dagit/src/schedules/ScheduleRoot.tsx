import {gql, useQuery} from '@apollo/client';
import {Colors, IBreadcrumbProps} from '@blueprintjs/core';
import * as React from 'react';

import {ScrollContainer} from 'src/ListComponents';
import {Loading} from 'src/Loading';
import {useDocumentTitle} from 'src/hooks/useDocumentTitle';
import {TopNav} from 'src/nav/TopNav';
import {RunTable} from 'src/runs/RunTable';
import {ScheduleDetails} from 'src/schedules/ScheduleDetails';
import {SCHEDULE_DEFINITION_FRAGMENT} from 'src/schedules/ScheduleUtils';
import {SCHEDULER_FRAGMENT} from 'src/schedules/SchedulerInfo';
import {PreviousRunsForScheduleQuery} from 'src/schedules/types/PreviousRunsForScheduleQuery';
import {
  ScheduleRootQuery,
  ScheduleRootQuery_scheduleDefinitionOrError_ScheduleDefinition as ScheduleDefinition,
} from 'src/schedules/types/ScheduleRootQuery';
import {Box} from 'src/ui/Box';
import {Group} from 'src/ui/Group';
import {Subheading} from 'src/ui/Text';
import {repoAddressAsString} from 'src/workspace/repoAddressAsString';
import {repoAddressToSelector} from 'src/workspace/repoAddressToSelector';
import {RepoAddress} from 'src/workspace/types';
import {workspacePathFromAddress} from 'src/workspace/workspacePath';

interface Props {
  scheduleName: string;
  repoAddress: RepoAddress;
  runTab?: string;
}

export const ScheduleRoot: React.FC<Props> = (props) => {
  const {scheduleName, repoAddress, runTab} = props;
  useDocumentTitle(`Schedule: ${scheduleName}`);

  const scheduleSelector = {
    ...repoAddressToSelector(repoAddress),
    scheduleName,
  };

  const queryResult = useQuery<ScheduleRootQuery>(SCHEDULE_ROOT_QUERY, {
    variables: {
      scheduleSelector,
    },
    fetchPolicy: 'cache-and-network',
    pollInterval: 15 * 1000,
    partialRefetch: true,
  });

  return (
    <Loading queryResult={queryResult} allowStaleData={true}>
      {({scheduleDefinitionOrError}) => {
        if (scheduleDefinitionOrError.__typename !== 'ScheduleDefinition') {
          return null;
        }

        const breadcrumbs: IBreadcrumbProps[] = [
          {
            icon: 'cube',
            text: 'Workspace',
            href: '/workspace',
          },
          {
            text: repoAddressAsString(repoAddress),
            href: workspacePathFromAddress(repoAddress),
          },
          {
            icon: 'time',
            text: 'Schedules',
            href: workspacePathFromAddress(repoAddress, '/schedules'),
          },
        ];

        return (
          <ScrollContainer>
            <TopNav breadcrumbs={breadcrumbs} />
            <Group direction="vertical" spacing={24} padding={{vertical: 20, horizontal: 24}}>
              <ScheduleDetails repoAddress={repoAddress} schedule={scheduleDefinitionOrError} />
              <SchedulePreviousRuns
                repoAddress={repoAddress}
                schedule={scheduleDefinitionOrError}
                runTab={runTab}
              />
            </Group>
          </ScrollContainer>
        );
      }}
    </Loading>
  );
};

interface SchedulePreviousRunsProps {
  repoAddress: RepoAddress;
  runTab?: string;
  schedule: ScheduleDefinition;
}

const SchedulePreviousRuns: React.FC<SchedulePreviousRunsProps> = (props) => {
  const {schedule} = props;
  const {data, loading} = useQuery<PreviousRunsForScheduleQuery>(PREVIOUS_RUNS_FOR_SCHEDULE_QUERY, {
    fetchPolicy: 'cache-and-network',
    variables: {
      filter: {
        pipelineName: schedule.pipelineName,
        tags: [{key: 'dagster/schedule_name', value: schedule.name}],
      },
    },
  });

  const content = () => {
    if (loading) {
      return <Box margin={{top: 8}}>Loading...</Box>;
    }
    if (!data?.pipelineRunsOrError || data?.pipelineRunsOrError.__typename !== 'PipelineRuns') {
      return <Box margin={{top: 8}}>Error!</Box>;
    }
    const runs = data?.pipelineRunsOrError.results;
    return <RunTable onSetFilter={() => {}} runs={runs} />;
  };

  return (
    <Group direction="vertical" spacing={4}>
      <Box
        padding={{bottom: 12}}
        border={{side: 'bottom', width: 1, color: Colors.LIGHT_GRAY3}}
        flex={{direction: 'row'}}
      >
        <Subheading>Runs</Subheading>
      </Box>
      <div style={{color: Colors.GRAY3}}>{content()}</div>
    </Group>
  );
};

export const SCHEDULE_ROOT_QUERY = gql`
  query ScheduleRootQuery($scheduleSelector: ScheduleSelector!) {
    scheduler {
      ...SchedulerFragment
    }
    scheduleDefinitionOrError(scheduleSelector: $scheduleSelector) {
      ... on ScheduleDefinition {
        id
        ...ScheduleDefinitionFragment
      }
      ... on ScheduleDefinitionNotFoundError {
        message
      }
      ... on PythonError {
        message
        stack
      }
    }
  }

  ${SCHEDULER_FRAGMENT}
  ${SCHEDULE_DEFINITION_FRAGMENT}
`;

const PREVIOUS_RUNS_FOR_SCHEDULE_QUERY = gql`
  query PreviousRunsForScheduleQuery($filter: PipelineRunsFilter) {
    pipelineRunsOrError(filter: $filter) {
      __typename
      ... on PipelineRuns {
        results {
          id
          ... on PipelineRun {
            ...RunTableRunFragment
          }
        }
      }
    }
  }
  ${RunTable.fragments.RunTableRunFragment}
`;
