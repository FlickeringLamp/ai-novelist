export const createPathStabilizer = (): ((path: string | undefined) => boolean) => {
  let lastSeenPath: string | undefined = undefined;

  return (path: string | undefined): boolean => {
    const pathHasStabilized = lastSeenPath !== undefined && lastSeenPath === path;
    lastSeenPath = path;
    return pathHasStabilized && !!path;
  };
};
