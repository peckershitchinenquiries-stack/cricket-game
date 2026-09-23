import type { Metadata } from 'next';
import { ResultsScreen } from '@/components/screens/ResultsScreen';

export const metadata: Metadata = {
  title: 'Your results',
  robots: { index: false },
};

export default function ResultsPage() {
  return <ResultsScreen />;
}
