# ADR-004: Next.js 16 conventions and Dev Server Memory limits

## Status
Accepted

## Context
Next.js was upgraded to version 16. During local development, the Next.js dev server (`next dev --turbopack`) frequently crashed with **exit code 134** (SIGABRT/Out of Memory). 

In addition, Next.js 16 deprecated the old `middleware.ts` file convention and introduced `proxy.ts` (along with the named `proxy` function export) to run code before a request is completed. Our previous rename to `middleware.ts` triggered Next.js deprecation warnings:
`⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`

## Decision
1. **Remove Strict Memory Limits in Dev:** We will increase the memory budget limits in [dev.ts](file:///c:/Users/vutm/Desktop/workspace/tinix-repo-trending/dev.ts). Instead of hard-capping Next.js to 1536MB and the Combined Worker to 1024MB (which triggers exit code 134 OOM crash under Turbopack compiling pressure), we will increase Next.js max heap size to `4096` (4GB) and the Combined Worker heap size to `2048` (2GB).
2. **Standardize Next.js 16 Proxy Convention:** Rename the middleware file to `src/proxy.ts` and export the named `proxy` function to conform to Next.js 16 conventions.

## Rationale
* Next.js 16 with Turbopack uses a native compiler which requires more memory during hot reloads (HMR) and AST caching than Webpack did in simple configurations. Capping it at 1.5GB is too aggressive for daily local development.
* Conforming to the Next.js 16 `proxy.ts` convention clears deprecation warnings and prevents potential routing or compilation aborts.

## Consequences
- **Positive:** Dev server runs stably without exit code 134 crashes. Clean build/dev console with zero deprecation warnings.
- **Negative:** Slightly higher peak RAM usage in dev mode.
- **Mitigation:** Setting a reasonable ceiling of 4GB for Next.js and 2GB for the worker avoids infinite memory leaks while preventing crashes.
