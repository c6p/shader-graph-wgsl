import { listen, listenWindow } from './utils';

export class Zoom {

    el: HTMLElement;
    intensity: number;
    onzoom: Function;
    previous: { cx: number; cy: number; distance: number } | null = null;

    pointers: PointerEvent[] = [];
    destroy: () => void;

    constructor(container: HTMLElement, el: HTMLElement, intensity: number, onzoom: Function) {
        this.el = el;
        this.intensity = intensity;
        this.onzoom = onzoom;

        const disposables = [
            listenWindow('pointermove', this.move),
            listenWindow('pointerup', this.end),
            listenWindow('pointercancel', this.end),
            listen(container, 'wheel', this.wheel),
            listen(container, 'pointerdown', this.down),
            // listen(container, 'dblclick', this.dblclick),
        ];

        this.destroy = () => { disposables.forEach(i => i()); disposables.length = 0; }
    }

    get translating() { // is translating while zoom (works on multitouch)
        return this.pointers.length >= 2;
    }

    wheel = (e: WheelEvent) => {
        e.preventDefault();

        const rect = this.el.getBoundingClientRect();
        const isNegative = e.deltaY < 0;
        const delta = isNegative ? this.intensity : - this.intensity;
        const ox = (rect.left - e.clientX) * delta;
        const oy = (rect.top - e.clientY) * delta;

        this.onzoom(delta, ox, oy, 'wheel');
    }

    touches() {
        const e = { touches: this.pointers }
        const [x1, y1] = [e.touches[0].clientX, e.touches[0].clientY];
        const [x2, y2] = [e.touches[1].clientX, e.touches[1].clientY];

        const distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));

        return {
            cx: (x1 + x2)/2,
            cy: (y1 + y2)/2,
            distance
        };
    }

    down = (e: PointerEvent) => {
        this.pointers.push(e);
    }

    move = (e: PointerEvent) => {
        this.pointers = this.pointers.map(p => p.pointerId === e.pointerId ? e : p)
        if (!this.translating) return;

        const rect = this.el.getBoundingClientRect();

        const { cx, cy, distance } = this.touches();

        if (this.previous !== null) {
            const delta = distance / this.previous.distance - 1;

            const ox = (rect.left - cx) * delta;
            const oy = (rect.top - cy) * delta;

            this.onzoom(delta, ox - (this.previous.cx - cx), oy - (this.previous.cy - cy), 'touch');
        }
        this.previous = { cx, cy, distance };
    }

    end = (e: PointerEvent) => {
        this.previous = null;
        this.pointers = this.pointers.filter(p => p.pointerId !== e.pointerId)
    }

    dblclick = (e: MouseEvent) => {
        if ((e.target as HTMLElement) !== this.el.parentNode) return;
        e.preventDefault();

        const rect = this.el.getBoundingClientRect();
        const delta = 4 * this.intensity;

        const ox = (rect.left - e.clientX) * delta;
        const oy = (rect.top - e.clientY) * delta;

        this.onzoom(delta, ox, oy, 'dblclick');
    }
}
