/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.jsx" {
  import type { ComponentType } from "react";
  const Component: ComponentType<any>;
  export default Component;
}
