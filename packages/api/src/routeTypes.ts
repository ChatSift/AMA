import type {
	InferRoutePath,
	InferRouteMethod,
	InferRouteBody,
	InferRouteResult,
	RouteMethod,
} from '@chatsift/rest-utils';
import type * as routes from './routes/index';

type Narrow<T, U> = T extends U ? T : never;
type ConstructorToType<TConstructor> = TConstructor extends new (...args: any[]) => infer T ? T : never;
type RoutesByClassNames = {
	[K in keyof typeof routes]: ConstructorToType<typeof routes[K]>;
};
type RoutesByPaths = {
	[Path in InferRoutePath<RoutesByClassNames[keyof RoutesByClassNames]>]: Narrow<
		RoutesByClassNames[keyof RoutesByClassNames],
		{ info: { path: Path } }
	>;
};

type RouteMethodMap = {
	[RouteMethod.get]: 'get';
	[RouteMethod.post]: 'post';
	[RouteMethod.put]: 'put';
	[RouteMethod.delete]: 'delete';
	[RouteMethod.patch]: 'patch';
};

export type AMARoutes = {
	[Path in keyof RoutesByPaths]: {
		[Method in RouteMethodMap[InferRouteMethod<RoutesByPaths[Path]>]]: Narrow<
			RoutesByPaths[Path],
			{ info: { method: Method } }
		>;
	};
};

export type InferAMARouteBody<TPath extends keyof AMARoutes, TMethod extends keyof AMARoutes[TPath]> = InferRouteBody<
	AMARoutes[TPath][TMethod]
>;

export type InferAMARouteResult<
	TPath extends keyof AMARoutes,
	TMethod extends keyof AMARoutes[TPath],
> = InferRouteResult<AMARoutes[TPath][TMethod]>;

export * from './util/models';
