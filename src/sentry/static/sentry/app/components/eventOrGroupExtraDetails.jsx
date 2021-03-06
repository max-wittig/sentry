import {Flex, Box} from 'grid-emotion';
import {Link, withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {tct} from 'app/locale';
import EventAnnotation from 'app/components/events/eventAnnotation';
import InlineSvg from 'app/components/inlineSvg';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SentryTypes from 'app/sentryTypes';
import ShortId from 'app/components/shortId';
import Times from 'app/components/group/times';
import space from 'app/styles/space';

class EventOrGroupExtraDetails extends React.Component {
  static propTypes = {
    id: PropTypes.string,
    lastSeen: PropTypes.string,
    firstSeen: PropTypes.string,
    subscriptionDetails: PropTypes.shape({
      reason: PropTypes.string,
    }),
    numComments: PropTypes.number,
    logger: PropTypes.string,
    annotations: PropTypes.arrayOf(PropTypes.string),
    assignedTo: PropTypes.shape({
      name: PropTypes.string,
    }),
    showAssignee: PropTypes.bool,
    shortId: PropTypes.string,
    project: SentryTypes.Project,
  };

  render() {
    const {
      id,
      lastSeen,
      firstSeen,
      subscriptionDetails,
      numComments,
      logger,
      assignedTo,
      annotations,
      showAssignee,
      shortId,
      project,
      params,
    } = this.props;

    const issuesPath = `/organizations/${params.orgId}/issues/`;

    return (
      <GroupExtra align="center">
        {shortId && (
          <GroupShortId
            shortId={shortId}
            avatar={
              project && (
                <ProjectBadge project={project} avatarSize={14} hideName={true} />
              )
            }
          />
        )}
        <Times lastSeen={lastSeen} firstSeen={firstSeen} />
        <GroupExtraCommentsAndLogger>
          {numComments > 0 && (
            <Box mr={2}>
              <CommentsLink to={`${issuesPath}${id}/activity/`} className="comments">
                <GroupExtraIcon
                  src="icon-comment-sm"
                  mentioned={
                    subscriptionDetails && subscriptionDetails.reason === 'mentioned'
                  }
                />
                <span>{numComments}</span>
              </CommentsLink>
            </Box>
          )}
          {logger && (
            <LoggerAnnotation>
              <Link
                to={{
                  pathname: issuesPath,
                  query: {
                    query: 'logger:' + logger,
                  },
                }}
              >
                {logger}
              </Link>
            </LoggerAnnotation>
          )}
        </GroupExtraCommentsAndLogger>
        {annotations &&
          annotations.map((annotation, key) => {
            return (
              <EventAnnotation
                dangerouslySetInnerHTML={{
                  __html: annotation,
                }}
                key={key}
              />
            );
          })}

        {showAssignee && assignedTo && (
          <div>{tct('Assigned to [name]', {name: assignedTo.name})}</div>
        )}
      </GroupExtra>
    );
  }
}

const GroupExtra = styled(Flex)`
  color: ${p => p.theme.gray3};
  font-size: 12px;
  position: relative;

  a {
    color: inherit;
  }
`;

const GroupExtraCommentsAndLogger = styled(Flex)`
  color: ${p => p.theme.gray4};
`;

const CommentsLink = styled(Link)`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const GroupShortId = styled(ShortId)`
  margin-right: ${space(2)};
  flex-shrink: 0;
  font-size: 12px;
  color: ${p => p.theme.gray3};
`;

const GroupExtraIcon = styled(InlineSvg)`
  color: ${p => (p.isMentioned ? p.theme.green : null)};
  font-size: 11px;
  margin-right: 4px;
`;

const LoggerAnnotation = styled(EventAnnotation)`
  margin-right: ${space(2)};
`;

export default withRouter(EventOrGroupExtraDetails);
