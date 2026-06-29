'use client';
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'selectedDriver';

export function useDriver() {
  const [driverName, setDriverNameState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDriverNameState(stored);
    setIsLoading(false);
  }, []);

  const setDriverName = (name: string) => {
    localStorage.setItem(STORAGE_KEY, name);
    setDriverNameState(name);
  };

  const clearDriver = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDriverNameState(null);
  };

  return { driverName, setDriverName, clearDriver, isLoading };
}
