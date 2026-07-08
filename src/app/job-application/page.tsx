'use client'

// Public iş başvuru sayfası — thin wrapper.
// Faz 1 (KVKK): akış KVKK → sağlık → başvuru; JobApplicationFlow yönetir.

import { JobApplicationFlow } from '@/components/job-application/JobApplicationFlow'

export default function JobApplicationPage() {
  return <JobApplicationFlow />
}
