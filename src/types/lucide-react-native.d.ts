// Ambient type declaration for `lucide-react-native`.
//
// lucide-react-native@1.17.0 points its "types"/exports at
// `dist/lucide-react-native.d.ts`, but that declaration file is NOT shipped in
// the published package (only dist/cjs and dist/esm exist). Under
// `moduleResolution: bundler` + `strict`, that makes every icon import an
// implicit `any` (TS7016). This shorthand ambient declaration (the fix the TS
// diagnostic itself suggests) lets the icon imports resolve without touching the
// theme system or any runtime behavior. Icons are consumed only as components,
// so the lack of per-icon prop typing has no practical impact here.
declare module "lucide-react-native";
