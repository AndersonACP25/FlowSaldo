import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccessGate } from './src/AccessGate';
import { ThemeProvider } from './src/ThemeProvider';

const client = new QueryClient();

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AccessGate />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
