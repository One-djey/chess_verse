import { useContext } from "react";
import { P2PContext } from "../context/P2PContext";
import type { P2PContextValue } from "../context/P2PContext";

export function useP2P(): P2PContextValue {
  const ctx = useContext(P2PContext);
  if (!ctx) throw new Error("useP2P must be used inside P2PProvider");
  return ctx;
}
