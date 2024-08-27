import { useState, useCallback } from "react";

export function useForceRerender() {
  const [, updateState] = useState<object>();
  const forceUpdate = useCallback(() => updateState({}), []);

  return forceUpdate;
}
