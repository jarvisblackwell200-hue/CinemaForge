"use client";

import { use } from "react";
import { Sidebar } from "./Sidebar";

interface MovieSidebarWrapperProps {
  params: Promise<{ movieId: string }>;
}

export function MovieSidebarWrapper({ params }: MovieSidebarWrapperProps) {
  const { movieId } = use(params);
  // TODO: Fetch actual movie status from API/store
  const movieStatus = "CONCEPT";

  return <Sidebar movieId={movieId} movieStatus={movieStatus} />;
}
