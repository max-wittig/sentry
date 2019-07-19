import React from 'react';
import styled from 'react-emotion';
import _ from 'lodash';

import space from 'app/styles/space';
import DateTime from 'app/components/dateTime';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';

import {SpanType, SpanEntry, SentryEvent} from './types';
import {isValidSpanID, toPercent} from './utils';
import {DragManagerChildrenProps} from './drag_manager';

type TraceType = {
  type: 'trace';
  span_id: string;
  trace_id: string;
};

type LookupType = {[span_id: string]: SpanType[]};

type SpanTreeProps = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  event: SentryEvent;
  dragProps: DragManagerChildrenProps;
};

type Foo = {
  spanTree: JSX.Element;
  numOfHiddenSpansAbove: number;
};

class SpanTree extends React.Component<SpanTreeProps> {
  renderSpan = ({
    numOfHiddenSpansAbove,
    spanID,
    traceID,
    lookup,
    span,
    generateBounds,
  }: {
    numOfHiddenSpansAbove: number;
    spanID: string;
    traceID: string;
    span: Readonly<SpanType>;
    lookup: Readonly<LookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  }): Foo => {
    const spanChildren: SpanType[] = _.get(lookup, spanID, []);

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    const bounds = generateBounds({
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
    });

    const isCurrentSpanHidden = bounds.end <= 0;

    type AccType = {
      renderedSpanChildren: JSX.Element[];
      numOfHiddenSpansAbove: number;
    };

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, span) => {
        const key = `${traceID}${span.span_id}`;

        const foo = this.renderSpan({
          numOfHiddenSpansAbove: acc.numOfHiddenSpansAbove,
          span,
          spanID: span.span_id,
          traceID,
          lookup,
          generateBounds,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{foo.spanTree}</React.Fragment>
        );

        acc.numOfHiddenSpansAbove = foo.numOfHiddenSpansAbove;

        return acc;
      },
      {
        renderedSpanChildren: [],
        numOfHiddenSpansAbove: isCurrentSpanHidden ? numOfHiddenSpansAbove + 1 : 0,
      }
    );

    const hiddenSpansMessage =
      !isCurrentSpanHidden && numOfHiddenSpansAbove > 0 ? (
        <SpanRowMessage>
          <span>Number of hidden spans: {numOfHiddenSpansAbove}</span>
        </SpanRowMessage>
      ) : null;

    return {
      numOfHiddenSpansAbove: reduced.numOfHiddenSpansAbove,
      spanTree: (
        <React.Fragment>
          {hiddenSpansMessage}
          <Span span={span} generateBounds={generateBounds} />
          {reduced.renderedSpanChildren}
        </React.Fragment>
      ),
    };
  };

  renderRootSpan = (): JSX.Element | null => {
    const {event, dragProps} = this.props;

    const trace: TraceType | undefined = _.get(event, 'contexts.trace');

    if (!trace) {
      return null;
    }

    const parsedTrace = this.parseTrace();

    // TODO: ideally this should be provided
    const rootSpan: SpanType = {
      trace_id: trace.trace_id,
      parent_span_id: void 0,
      span_id: trace.span_id,
      start_timestamp: parsedTrace.traceStartTimestamp,
      timestamp: parsedTrace.traceEndTimestamp,
      same_process_as_parent: true,
      op: 'transaction',
      data: {},
    };

    const traceEndTimestamp = _.isNumber(parsedTrace.traceEndTimestamp)
      ? parsedTrace.traceStartTimestamp == parsedTrace.traceEndTimestamp
        ? parsedTrace.traceStartTimestamp + 0.05
        : parsedTrace.traceEndTimestamp
      : parsedTrace.traceStartTimestamp + 0.05;

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    return this.renderSpan({
      numOfHiddenSpansAbove: 0,
      span: rootSpan,
      spanID: trace.span_id,
      traceID: trace.trace_id,
      lookup: parsedTrace.lookup,
      generateBounds,
    }).spanTree;
  };

  parseTrace = () => {
    const {event} = this.props;

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: SpanType[] = _.get(spanEntry, 'data', []);

    if (!spanEntry || spans.length <= 0) {
      return {
        lookup: {},
        traceStartTimestamp: 0,
        traceEndTimestamp: 0,
      };
    }

    // we reduce spans to become an object mapping span ids to their children

    type ReducedType = {
      lookup: LookupType;
      traceStartTimestamp: number;
      traceEndTimestamp: number;
    };

    const init: ReducedType = {
      lookup: {},
      traceStartTimestamp: spans[0].start_timestamp,
      traceEndTimestamp: 0,
    };

    const reduced: ReducedType = spans.reduce((acc, span) => {
      if (!isValidSpanID(span.parent_span_id)) {
        return acc;
      }

      const spanChildren: SpanType[] = _.get(acc.lookup, span.parent_span_id!, []);

      spanChildren.push(span);

      _.set(acc.lookup, span.parent_span_id!, spanChildren);

      if (!acc.traceStartTimestamp || span.start_timestamp < acc.traceStartTimestamp) {
        acc.traceStartTimestamp = span.start_timestamp;
      }

      // establish trace end timestamp

      const hasEndTimestamp = _.isNumber(span.timestamp);

      if (!acc.traceEndTimestamp) {
        if (hasEndTimestamp) {
          acc.traceEndTimestamp = span.timestamp;
          return acc;
        }

        acc.traceEndTimestamp = span.start_timestamp;
        return acc;
      }

      if (hasEndTimestamp && span.timestamp! > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.timestamp;
        return acc;
      }

      if (span.start_timestamp > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.start_timestamp;
      }

      return acc;
    }, init);

    // sort span children by their start timestamps in ascending order

    _.forEach(reduced.lookup, spanChildren => {
      spanChildren.sort((firstSpan, secondSpan) => {
        if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
          return -1;
        }

        if (firstSpan.start_timestamp === secondSpan.start_timestamp) {
          return 0;
        }

        return 1;
      });
    });

    return reduced;
  };

  render() {
    return (
      <TraceViewContainer innerRef={this.props.traceViewRef}>
        {this.renderRootSpan()}
      </TraceViewContainer>
    );
  }
}

type SpanPropTypes = {
  span: Readonly<SpanType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
};

type SpanState = {
  displayDetail: boolean;
};

class Span extends React.Component<SpanPropTypes, SpanState> {
  state: SpanState = {
    displayDetail: false,
  };

  toggleDisplayDetail = () => {
    this.setState(state => {
      return {
        displayDetail: !state.displayDetail,
      };
    });
  };

  renderDetail = ({isVisible}: {isVisible: boolean}) => {
    if (!this.state.displayDetail || !isVisible) {
      return null;
    }

    const {span} = this.props;

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    const duration = (end_timestamp - start_timestamp) * 1000;
    const durationString = `${duration.toFixed(3)} ms`;

    const Row = ({
      title,
      keep,
      children,
    }: {
      title: string;
      keep?: boolean;
      children: JSX.Element | string;
    }) => {
      if (!keep && !children) {
        return null;
      }

      return (
        <tr>
          <td className="key">{title}</td>
          <td className="value">
            <pre className="val ">
              <span className="val-string">{children}</span>
            </pre>
          </td>
        </tr>
      );
    };

    const Tags = ({span}: {span: SpanType}) => {
      const tags: {[tag_name: string]: string} | undefined = _.get(span, 'tags');

      if (!tags) {
        return null;
      }

      const keys = Object.keys(tags);

      if (keys.length <= 0) {
        return null;
      }

      return (
        <tr>
          <td className="key">Tags</td>
          <td className="value">
            <Pills style={{padding: '8px'}}>
              {keys.map((key, index) => {
                return <Pill key={index} name={key} value={String(tags[key]) || ''} />;
              })}
            </Pills>
          </td>
        </tr>
      );
    };

    return (
      <SpanDetail
        data-component="span-detail"
        onClick={event => {
          // prevent toggling the span detail
          event.stopPropagation();
        }}
      >
        <table className="table key-value">
          <tbody>
            <Row title="Span ID">{span.span_id}</Row>
            <Row title="Trace ID">{span.trace_id}</Row>
            <Row title="Parent Span ID">{span.parent_span_id || ''}</Row>
            <Row title="Description">{_.get(span, 'description', '')}</Row>
            <Row title="Start Date">
              <React.Fragment>
                <DateTime date={start_timestamp * 1000} />
                {` (${start_timestamp})`}
              </React.Fragment>
            </Row>
            <Row title="End Date">
              <React.Fragment>
                <DateTime date={end_timestamp * 1000} />
                {` (${end_timestamp})`}
              </React.Fragment>
            </Row>
            <Row title="Duration">{durationString}</Row>
            <Row title="Operation">{span.op || ''}</Row>
            <Row title="Same Process as Parent">
              {String(!!span.same_process_as_parent)}
            </Row>
            <Tags span={span} />
            {_.map(_.get(span, 'data', {}), (value, key) => {
              return (
                <Row title={key} key={key}>
                  {JSON.stringify(value, null, 4) || ''}
                </Row>
              );
            })}
            <Row title="Raw">{JSON.stringify(span, null, 4)}</Row>
          </tbody>
        </table>
      </SpanDetail>
    );
  };

  getBounds = () => {
    const {span, generateBounds} = this.props;

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    return generateBounds({
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
    });
  };

  renderTitle = () => {
    const {span} = this.props;

    const op = span.op ? <strong>{`${span.op} \u2014 `}</strong> : '';
    const description = _.get(span, 'description', span.span_id);

    const bounds = this.getBounds();

    return (
      <SpanBarTitle
        style={{
          left: toPercent(bounds.start),
          width: toPercent(bounds.end - bounds.start),
        }}
      >
        {op}
        {description}
      </SpanBarTitle>
    );
  };

  render() {
    const {span} = this.props;

    const start_timestamp: number = span.start_timestamp;
    const end_timestamp: number = span.timestamp;

    const duration = (end_timestamp - start_timestamp) * 1000;
    const durationString = `${duration.toFixed(3)} ms`;

    const bounds = this.getBounds();

    const isVisible = bounds.end > 0;

    return (
      <SpanRow
        style={{
          display: isVisible ? 'block' : 'none',
          boxShadow: this.state.displayDetail ? '0 -1px 0 #d1cad8' : void 0,
        }}
        onClick={() => {
          this.toggleDisplayDetail();
        }}
      >
        <SpanBar
          data-span="true"
          style={{
            left: toPercent(bounds.start),
            width: toPercent(bounds.end - bounds.start),
          }}
        />
        {this.renderTitle()}
        <Duration>{durationString}</Duration>
        {this.renderDetail({isVisible})}
      </SpanRow>
    );
  }
}

const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

const SPAN_ROW_HEIGHT = 25;

const SpanRow = styled('div')`
  position: relative;
  overflow: hidden;

  cursor: pointer;
  transition: background-color 0.15s ease-in-out;

  &:nth-child(even) {
    background-color: rgba(231, 225, 236, 0.2);
  }

  &:last-child {
    & > [data-component='span-detail'] {
      border-bottom: none !important;
    }
  }

  &:hover {
    background-color: rgba(189, 180, 199, 0.1);

    & > [data-span='true'] {
      transition: background-color 0.15s ease-in-out;
      background-color: rgba(211, 207, 238, 0.75);
    }
  }
`;

const SpanRowMessage = styled(SpanRow)`
  cursor: auto;

  color: #4a3e56;
  font-size: 12px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  padding-left: ${space(1)};
  padding-right: ${space(1)};

  background-color: #f1f5fb !important;

  outline: 1px solid #c9d4ea;

  z-index: 99999;
`;

const SpanBarTitle = styled('div')`
  position: absolute;
  top: 0;

  height: ${SPAN_ROW_HEIGHT}px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  color: #4a3e56;
  font-size: 12px;

  user-select: none;
  margin-left: 10px;

  white-space: nowrap;
`;

const Duration = styled('div')`
  position: absolute;
  right: 0;
  top: 0;
  height: ${SPAN_ROW_HEIGHT}px;
  line-height: ${SPAN_ROW_HEIGHT}px;

  color: #9585a3;
  font-size: 12px;
  padding-right: ${space(1)};

  user-select: none;
`;

const SpanBar = styled('div')`
  position: relative;
  min-height: ${SPAN_ROW_HEIGHT - 4}px;
  height: ${SPAN_ROW_HEIGHT - 4}px;
  max-height: ${SPAN_ROW_HEIGHT - 4}px;

  margin-top: 2px;
  margin-bottom: 2px;
  border-radius: 3px;

  overflow: hidden;

  user-select: none;

  padding: 4px;

  background-color: rgba(211, 207, 238, 1);
`;

const SpanDetail = styled('div')`
  border-bottom: 1px solid #d1cad8;
  padding: ${space(2)};
  background-color: #fff;

  cursor: auto;
`;

type SpanBoundsType = {startTimestamp: number; endTimestamp: number};
type SpanGeneratedBoundsType = {start: number; end: number};

const boundsGenerator = (bounds: {
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  viewStart: number; // in [0, 1]
  viewEnd: number; // in [0, 1]
}) => {
  const {traceEndTimestamp, traceStartTimestamp, viewStart, viewEnd} = bounds;

  // viewStart and viewEnd are percentage values (%) of the view window relative to the left
  // side of the trace view minimap

  // invariant: viewStart <= viewEnd

  // duration of the entire trace in seconds
  const duration = traceEndTimestamp - traceStartTimestamp;

  const viewStartTimestamp = traceStartTimestamp + viewStart * duration;
  const viewEndTimestamp = traceEndTimestamp - (1 - viewEnd) * duration;
  const viewDuration = viewEndTimestamp - viewStartTimestamp;

  return (spanBounds: SpanBoundsType): SpanGeneratedBoundsType => {
    const {startTimestamp, endTimestamp} = spanBounds;

    const start = (startTimestamp - viewStartTimestamp) / viewDuration;

    if (!_.isNumber(endTimestamp)) {
      return {
        start,
        end: 1,
      };
    }

    return {
      start,
      end: (endTimestamp - viewStartTimestamp) / viewDuration,
    };
  };
};

export default SpanTree;
