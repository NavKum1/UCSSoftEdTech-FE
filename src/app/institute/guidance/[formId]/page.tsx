"use client";

import React, { Suspense } from "react";
import { useParams } from "next/navigation";
import FormBuilder from "@/components/guidance/editor/FormBuilder";

export default function InstituteFormPage() {
  const { formId } = useParams<{ formId: string }>();
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <FormBuilder formId={formId} backHref="/institute/guidance" />
    </Suspense>
  );
}
