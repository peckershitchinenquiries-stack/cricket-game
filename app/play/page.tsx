import type { Metadata } from 'next';
import { PlayScreen } from '@/components/screens/PlayScreen';

export const metadata: Metadata = {
  title: "Today's round",
  robots: { index: false },
};

export default function PlayPage() {
  return <PlayScreen />;
}
