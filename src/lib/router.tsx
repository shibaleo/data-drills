/**
 * Thin wrapper around Next.js routing primitives.
 * When migrating to TanStack Router, only this file needs to change.
 */

// Re-export from Next.js for now
export { default as Link } from "next/link";
export { usePathname, useRouter, redirect } from "next/navigation";
