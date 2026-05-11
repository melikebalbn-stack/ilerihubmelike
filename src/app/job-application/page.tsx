'use client'

// PR-JOBAPP-RENDERER: Public iş başvuru sayfası — thin wrapper.
// Form mantığı tamamen JobApplicationRenderer'da.

import { JobApplicationRenderer } from '@/components/job-application/JobApplicationRenderer'

export default function JobApplicationPage() {
  return <JobApplicationRenderer />
}
