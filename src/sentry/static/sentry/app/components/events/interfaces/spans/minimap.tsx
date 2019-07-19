import React from 'react';
import styled from 'react-emotion';

import {rectOfContent, clamp, rectRelativeTo, rectOfElement, toPercent} from './utils';
import {DragManagerChildrenProps} from './drag_manager';

const MINIMAP_HEIGHT = 75;

type MinimapProps = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  minimapInteractiveRef: React.RefObject<HTMLDivElement>;
  dragProps: DragManagerChildrenProps;
};

type MinimapState = {
  showCursorGuide: boolean;
  mousePageX: number | undefined;
  startViewHandleX: number;
};

class Minimap extends React.Component<MinimapProps, MinimapState> {
  state: MinimapState = {
    showCursorGuide: false,
    mousePageX: void 0,
    startViewHandleX: 100,
  };

  minimapRef = React.createRef<HTMLCanvasElement>();

  componentDidMount() {
    this.drawMinimap();
  }

  drawMinimap = () => {
    const canvas = this.minimapRef.current;
    const traceViewDOM = this.props.traceViewRef.current;

    if (!canvas || !traceViewDOM) {
      return;
    }

    const canvasContext = canvas.getContext('2d');

    if (!canvasContext) {
      return;
    }

    const root_rect = rectOfContent(traceViewDOM);

    const scaleX = canvas.clientWidth / root_rect.width;
    const scaleY = canvas.clientHeight / root_rect.height;

    // https://www.html5rocks.com/en/tutorials/canvas/hidpi/
    // we consider the devicePixelRatio (dpr) factor so that the canvas looks decent on hidpi screens
    // such as retina macbooks
    const devicePixelRatio = window.devicePixelRatio || 1;

    const resize_canvas = (width: number, height: number) => {
      // scale the canvas up by the dpr factor
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;

      // scale the canvas down by the dpr factor thru CSS
      canvas.style.width = `100%`;
      canvas.style.height = `${height}px`;
    };

    resize_canvas(root_rect.width * scaleX, root_rect.height * scaleY);

    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.scale(scaleX, scaleY);

    // scale canvas operations by the dpr factor
    canvasContext.scale(devicePixelRatio, devicePixelRatio);

    const black = (pc: number) => `rgba(0,0,0,${pc / 100})`;
    const back = black(0);

    const drawRect = (
      rect: {x: number; y: number; width: number; height: number},
      colour: string
    ) => {
      if (colour) {
        canvasContext.beginPath();
        canvasContext.rect(rect.x, rect.y, rect.width, rect.height);
        canvasContext.fillStyle = colour;
        canvasContext.fill();
      }
    };

    // draw background

    drawRect(rectRelativeTo(root_rect, root_rect), back);

    // draw the spans

    Array.from(traceViewDOM.querySelectorAll<HTMLElement>('[data-span="true"]')).forEach(
      el => {
        const backgroundColor = window.getComputedStyle(el).backgroundColor || black(10);
        drawRect(rectRelativeTo(rectOfElement(el), root_rect), backgroundColor);
      }
    );
  };

  renderCursorGuide = () => {
    if (!this.state.showCursorGuide || !this.state.mousePageX) {
      return null;
    }

    const minimapCanvas = this.props.minimapInteractiveRef.current;

    if (!minimapCanvas) {
      return null;
    }

    const rect = rectOfContent(minimapCanvas);

    // clamp mouseLeft to be within [0, 100]
    let mouseLeft = clamp(((this.state.mousePageX - rect.x) / rect.width) * 100, 0, 100);

    return (
      <React.Fragment>
        <line
          x1={`${mouseLeft}%`}
          x2={`${mouseLeft}%`}
          y1="0"
          y2={MINIMAP_HEIGHT}
          strokeWidth="1"
          strokeOpacity="0.7"
          style={{stroke: '#E03E2F'}}
        />
      </React.Fragment>
    );
  };

  renderViewHandles = ({
    isDragging,
    onLeftHandleDragStart,
    leftHandlePosition,
    viewWindowStart,
    onRightHandleDragStart,
    rightHandlePosition,
    viewWindowEnd,
  }: DragManagerChildrenProps) => {
    const leftHandleGhost = isDragging ? (
      <g>
        <line
          x1={toPercent(viewWindowStart)}
          x2={toPercent(viewWindowStart)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
          opacity="0.5"
        />
        <ViewHandle
          x={toPercent(viewWindowStart)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={false}
          opacity="0.5"
        />
      </g>
    ) : null;

    const leftHandle = (
      <g>
        <line
          x1={toPercent(leftHandlePosition)}
          x2={toPercent(leftHandlePosition)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
        />
        <ViewHandle
          x={toPercent(leftHandlePosition)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={isDragging}
        />
      </g>
    );

    const rightHandle = (
      <g>
        <line
          x1={toPercent(rightHandlePosition)}
          x2={toPercent(rightHandlePosition)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
        />
        <ViewHandle
          x={toPercent(rightHandlePosition)}
          onMouseDown={onRightHandleDragStart}
          isDragging={isDragging}
        />
      </g>
    );

    const rightHandleGhost = isDragging ? (
      <g>
        <line
          x1={toPercent(viewWindowEnd)}
          x2={toPercent(viewWindowEnd)}
          y1="0"
          y2={MINIMAP_HEIGHT - 20}
          strokeWidth="1"
          strokeDasharray="4 3"
          style={{stroke: '#6C5FC7'}}
          opacity="0.5"
        />
        <ViewHandle
          x={toPercent(viewWindowEnd)}
          onMouseDown={onLeftHandleDragStart}
          isDragging={false}
          opacity="0.5"
        />
      </g>
    ) : null;

    return (
      <React.Fragment>
        {leftHandleGhost}
        {rightHandleGhost}
        {leftHandle}
        {rightHandle}
      </React.Fragment>
    );
  };

  renderFog = (dragProps: DragManagerChildrenProps) => {
    return (
      <React.Fragment>
        <Fog x={0} y={0} height="100%" width={toPercent(dragProps.viewWindowStart)} />
        <Fog
          x={toPercent(dragProps.viewWindowEnd)}
          y={0}
          height="100%"
          width={toPercent(1 - dragProps.viewWindowEnd)}
        />
      </React.Fragment>
    );
  };

  render() {
    return (
      <Container>
        <MinimapBackground innerRef={this.minimapRef} />
        <div
          ref={this.props.minimapInteractiveRef}
          style={{
            width: '100%',
            height: `${MINIMAP_HEIGHT}px`,
            position: 'relative',
            left: 0,
          }}
          onMouseEnter={event => {
            this.setState({
              showCursorGuide: true,
              mousePageX: event.pageX,
            });
          }}
          onMouseLeave={() => {
            this.setState({showCursorGuide: false, mousePageX: void 0});
          }}
          onMouseMove={event => {
            this.setState({
              showCursorGuide: true,
              mousePageX: event.pageX,
            });
          }}
        >
          <InteractiveLayer style={{overflow: 'visible'}}>
            {this.renderFog(this.props.dragProps)}
            {this.renderCursorGuide()}
            {this.renderViewHandles(this.props.dragProps)}
          </InteractiveLayer>
        </div>
      </Container>
    );
  }
}

const Container = styled('div')`
  width: 100%;
  position: relative;
  left: 0;
  border-bottom: 1px solid #d1cad8;
`;

const MinimapBackground = styled('canvas')`
  height: ${MINIMAP_HEIGHT}px;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
`;

const InteractiveLayer = styled('svg')`
  height: ${MINIMAP_HEIGHT}px;
  width: 100%;
  position: relative;
  left: 0;
`;

const ViewHandle = styled('rect')`
  fill: #6c5fc7;

  cursor: col-resize;

  height: 20px;

  ${({isDragging}: {isDragging: boolean}) => {
    if (isDragging) {
      return `
      width: 5px;
      transform: translate(-2.5px, ${MINIMAP_HEIGHT - 20}px);
      `;
    }

    return `
    width: 3px;
    transform: translate(-1.5px, ${MINIMAP_HEIGHT - 20}px);
    `;
  }};

  &:hover {
    width: 5px;
    transform: translate(-2.5px, ${MINIMAP_HEIGHT - 20}px);
  }
`;

const Fog = styled('rect')`
  fill: rgba(241, 245, 251, 0.5);
`;

export default Minimap;
