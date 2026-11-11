interface ImportMetaEnv {
    /** Public address of the AI backend. Required when building the Android app. */
    readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
