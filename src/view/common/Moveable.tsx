import './Moveable.less';
import React, { FC, useRef, useEffect } from 'react';
import { DefaultProps } from './types';
import { getOffset, listen, listenWindow } from '../../rete/view/utils';

type Rect = [x: number, y: number, w: number, h: number, px: number, py: number];

interface MoveableContext {
  startEl?: HTMLElement;
  moveState?: { x: number; y: number; w: number; h: number };
}
export const moveableContext = React.createContext<MoveableContext>({});

interface MoveableProps extends DefaultProps {
  gap?: number;
  x?: number;
  y?: number;
  containerEl?: HTMLElement;
}
export const Moveable: FC<MoveableProps> = ({ gap = 0, children, x = 0, y = 0, containerEl }) => {
  const canRef = useRef<HTMLElement>();
  const moveableState = useRef<MoveableContext>({});

  useEffect(() => {
    const el = canRef.current!;
    const moveState = { x, y, w: 0, h: 0 };
    let stateFromProps = true;
    moveableState.current.moveState = moveState;
    let startInfo: { sx: number; sy: number; cx: number; cy: number } | undefined;
    let canRectCache: Rect | undefined;
    const getCanRect = () => {
      if (canRectCache) return canRectCache;
      let canRect: Rect = [0, 0, innerWidth, innerHeight, 0, 0];
      if (containerEl) {
        const { x, y, width, height } = containerEl.getBoundingClientRect();
        const { x: offsetLeft, y: offsetTop } = getOffset(el.parentElement!, document.body, 100);
        canRect = [x, y, width, height, offsetLeft, offsetTop];
      }
      canRectCache = canRect;
      return canRect;
    };
    const move = () => {
      const [cx, cy, cw, ch, px, py] = getCanRect();
      if (stateFromProps) {
        moveState.x -= cx;
        moveState.y -= cy;
        stateFromProps = false;
      }
      const { x, y, w, h } = moveState;
      moveState.x = Math.max(gap + cx, Math.min(cx + cw - w - gap, x + px)) - px;
      moveState.y = Math.max(gap + cy, Math.min(cy + ch - h - gap, y + py)) - py;
      el.style.transform = `translate(${moveState.x}px, ${moveState.y}px)`;
    };

    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (height === 0 && width === 0) return;
      moveState.w = width;
      moveState.h = height;
      canRectCache = undefined;
      move();
    });

    resizeObserver.observe(el);

    const disposeables = [
      listen(el, 'pointerdown', e => {
        const srcEl = moveableState.current.startEl;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (srcEl && e.target !== srcEl) return;
        e.stopPropagation();
        startInfo = { sx: e.clientX, sy: e.clientY, cx: moveState.x, cy: moveState.y };
      }),
      listenWindow('pointermove', e => {
        if (!startInfo) return;
        const { sx, sy, cx, cy } = startInfo;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        moveState.x = cx + dx;
        moveState.y = cy + dy;
        move();
      }),
      listenWindow('pointerup', () => {
        if (startInfo) startInfo = undefined;
        canRectCache = undefined;
      }),
    ];
    return () => {
      disposeables.forEach(i => i());
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="sg-popup-movable" ref={el => (canRef.current = el!)}>
      <moveableContext.Provider value={moveableState.current}>{children}</moveableContext.Provider>
    </div>
  );
};
