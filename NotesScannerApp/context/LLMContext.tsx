import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { initLlama } from 'llama.rn';
import type { LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';
import type { ChatMessage } from '../lib/llm';
import { useNetwork } from './NetworkContext';

const MODEL_URL =
  'https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF/resolve/main/google_gemma-4-E2B-it-Q4_K_M.gguf';
const MODEL_FILENAME = MODEL_URL.split('/').pop()!;
const MODEL_PATH = FileSystem.documentDirectory + MODEL_FILENAME;

const STOP_TOKENS = ['<end_of_turn>', '<eos>', '</s>'];

export type LLMStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

type LLMContextValue = {
  generate: (messages: ChatMessage[]) => Promise<string>;
  status: LLMStatus;
  downloadProgress: number;
  error: string | null;
  modelExists: boolean | null;
  startDownload: () => void;
};

const LLMContext = createContext<LLMContextValue | null>(null);

export function LLMProvider({ children }: { children: React.ReactNode }) {
  const { isConnected, isForcedOffline } = useNetwork();
  const llamaRef = useRef<LlamaContext | null>(null);
  const [status, setStatus] = useState<LLMStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelExists, setModelExists] = useState<boolean | null>(null);

  const downloadRef = useRef(false);
  const initRef = useRef(false);

  // Check once on mount whether the model file is already on disk
  useEffect(() => {
    FileSystem.getInfoAsync(MODEL_PATH).then((info) => setModelExists(info.exists));
  }, []);

  // Load model into memory — only called when user is in offline mode
  const runInit = useCallback(async () => {
    if (initRef.current || llamaRef.current) return;
    initRef.current = true;
    setError(null);
    setStatus('loading');
    try {
      llamaRef.current = await initLlama({
        model: MODEL_PATH,
        use_mlock: true,
        n_ctx: 4096,
        n_gpu_layers: 99,
      });
      setStatus('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load model');
      setStatus('error');
    } finally {
      initRef.current = false;
    }
  }, []);

  // Download model file to disk — does NOT load into memory
  const startDownload = useCallback(async () => {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    if (info.exists) {
      setModelExists(true);
      setStatus('idle'); // clears any prior error so auto-init can retry
      return;
    }
    if (downloadRef.current) return;
    if (!isConnected) {
      setError('No internet connection. Connect to Wi-Fi to download the offline model.');
      setStatus('error');
      return;
    }
    downloadRef.current = true;
    setError(null);
    setStatus('downloading');
    const lastPct = { value: 0 };
    const dl = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PATH,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite === 0) return;
        const pct = totalBytesWritten / totalBytesExpectedToWrite;
        if (pct - lastPct.value >= 0.01) {
          lastPct.value = pct;
          setDownloadProgress(pct);
        }
      }
    );
    try {
      const result = await dl.downloadAsync();
      if (!result || result.status !== 200) {
        throw new Error(`Download failed (HTTP ${result?.status ?? 'unknown'})`);
      }
      setModelExists(true);
      setStatus('idle'); // auto-init effect handles RAM load if offline mode is active
    } catch (e: any) {
      setError(e?.message ?? 'Download failed');
      setStatus('error');
    } finally {
      downloadRef.current = false;
    }
  }, [isConnected]);

  // Load model into memory as soon as it's on disk and offline mode is active.
  // Fires when: user switches to offline (model already downloaded), or download
  // completes while already in offline mode.
  useEffect(() => {
    if (isForcedOffline && modelExists === true && status === 'idle') {
      runInit();
    }
  }, [isForcedOffline, modelExists, status, runInit]);

  // When user switches to offline, start download if model is missing
  useEffect(() => {
    if (!isForcedOffline) return;
    FileSystem.getInfoAsync(MODEL_PATH).then((info) => {
      if (info.exists) {
        setModelExists(true); // triggers auto-init above
      } else if (!isConnected) {
        setError('No internet connection. Connect to Wi-Fi to download the offline model.');
        setStatus('error');
      } else {
        startDownload(); // sets modelExists=true on success, auto-init handles the rest
      }
    });
  }, [isForcedOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async (messages: ChatMessage[]): Promise<string> => {
    if (!llamaRef.current) throw new Error('Model not ready');
    const result = await llamaRef.current.completion({
      messages,
      n_predict: 2048,
      temperature: 0.7,
      stop: STOP_TOKENS,
    });
    // Gemma 4 is a thinking model — strip <think>...</think> chain-of-thought blocks
    const stripped = result.text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    return stripped || result.text.trim();
  }, []);

  return (
    <LLMContext.Provider value={{ generate, status, downloadProgress, error, modelExists, startDownload }}>
      {children}
    </LLMContext.Provider>
  );
}

export function useLLMContext(): LLMContextValue {
  const ctx = useContext(LLMContext);
  if (!ctx) throw new Error('useLLMContext must be used inside LLMProvider');
  return ctx;
}
