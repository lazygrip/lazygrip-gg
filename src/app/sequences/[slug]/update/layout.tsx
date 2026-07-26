import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Update Sequence',
  robots: {
    index: false,
    follow: false,
  },
}

export default function UpdateSequenceLayout({ children }: { children: React.ReactNode }) {
  return children
}
