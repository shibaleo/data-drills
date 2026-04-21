"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/react";

export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
