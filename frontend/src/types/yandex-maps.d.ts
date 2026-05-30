/* Minimal Yandex Maps 2.1 typings for navigation. */
declare namespace ymaps {
  function ready(callback: () => void): void;

  function geocode(
    query: string,
    options?: object,
  ): Promise<{
    geoObjects: {
      get: (index: number) => GeocodeResultObject | null;
      getLength: () => number;
    };
  }>;

  interface GeocodeResultObject {
    geometry: { getCoordinates: () => [number, number] };
    properties: { get: (key: string) => unknown };
    getAddressLine?: () => string;
  }

  namespace control {
    class TrafficControl {
      constructor(options?: object);
      state: {
        set: (key: string | Record<string, unknown>, value?: unknown) => void;
        get: (key: string) => unknown;
      };
      getProvider?: (key: string) => { show?: () => void; hide?: () => void } | null;
    }
  }

  class Map {
    constructor(element: HTMLElement | string, state: object, options?: object);
    geoObjects: GeoObjectCollection;
    events: EventManager;
    controls: ControlManager;
    behaviors: BehaviorManager;
    setCenter(center: number[], zoom?: number, options?: object): void;
    setBounds(bounds: number[][], options?: object): void;
    setType(type: string): void;
    setZoom(zoom: number, options?: object): void;
    getZoom(): number;
    destroy(): void;
  }

  interface ControlManager {
    add(control: unknown, options?: object): void;
    get(name: string): { options: { set: (key: string, value: unknown) => void } } | null;
  }

  interface BehaviorManager {
    enable(behaviors: string | string[]): void;
    disable(behavior: string): void;
  }

  class Placemark {
    constructor(
      geometry: number[],
      properties?: object,
      options?: object,
    );
    events: EventManager;
    balloon: {
      open: () => void;
      close: () => void;
    };
  }

  const templateLayoutFactory: {
    createClass: (template: string) => unknown;
  };

  class Clusterer {
    constructor(options?: object);
    add(item: Placemark | Placemark[]): void;
    events: EventManager;
  }

  class GeoObjectCollection {
    add(item: unknown): void;
    remove(item: unknown): void;
    removeAll(): void;
  }

  class Polyline {
    constructor(geometry: number[][], properties?: object, options?: object);
  }

  interface EventManager {
    add(type: string, callback: (event: { get: (key: string) => unknown; stopPropagation?: () => void }) => void): void;
  }

  const util: {
    bounds: {
      fromPoints: (points: number[][]) => number[][];
    };
  };

  namespace multiRouter {
    class MultiRoute {
      constructor(
        model: {
          referencePoints: number[][];
          params?: { routingMode?: string };
        },
        options?: {
          boundsAutoApply?: boolean;
          wayPointVisible?: boolean;
          pinVisible?: boolean;
          routeActiveStrokeWidth?: number;
          routeActiveStrokeColor?: string;
        },
      );
      model: {
        events: EventManager;
        getRoutes: () => { getPaths: () => { get: (i: number) => { getCoordinates: () => number[][] } } };
        getHumanLength: () => string;
        getHumanTime: () => string;
      };
    }
  }
}
