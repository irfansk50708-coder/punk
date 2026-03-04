'use client';

import dynamic from 'next/dynamic';
import LoadingScreen from '@/components/LoadingScreen';

const PunkApp = dynamic(() => import('@/components/PunkApp'), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function Home() {
  return <PunkApp />;
}
