"use client";

import { ArrowLeft } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/icons";
import { ApiError, authApi } from "@/lib/api";
import {
  COUNTRIES,
  defaultCountry,
  joinPhone,
  matchPhone,
  prettyPhone,
  splitPhone,
  type Country,
} from "@/lib/countries";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";

const CODE_LENGTH = 6;

export function LoginFlow() {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [country, setCountry] = useState<Country>(defaultCountry);
  const [national, setNational] = useState("");
  const [phone, setPhone] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  async function requestCode(e164: string) {
    const result = await authApi.requestOtp(e164);
    setPhone(result.phone);
    setHint(result.hint);
    setStep("code");
  }

  function pickDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    const parts = splitPhone(account.phone);
    setCountry(parts.country);
    setNational(parts.national);
    void requestCode(account.phone).catch(() => setStep("phone"));
  }

  return (
    <main className="flex min-h-dvh items-center justify-center overflow-y-auto bg-chat px-4 py-10">
      <div className="w-full max-w-[400px]">
        {step === "phone" ? (
          <PhoneStep
            country={country}
            national={national}
            onCountry={setCountry}
            onNational={setNational}
            onSubmit={requestCode}
            onDemo={pickDemo}
          />
        ) : (
          <CodeStep phone={phone} hint={hint} onBack={() => setStep("phone")} />
        )}
      </div>
    </main>
  );
}

interface PhoneStepProps {
  country: Country;
  national: string;
  onCountry: (country: Country) => void;
  onNational: (value: string) => void;
  onSubmit: (e164: string) => Promise<void>;
  onDemo: (account: (typeof DEMO_ACCOUNTS)[number]) => void;
}

function PhoneStep({ country, national, onCountry, onNational, onSubmit, onDemo }: PhoneStepProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = national.replace(/\D/g, "");
  const valid = digits.length >= 6;

  // Typing or pasting a full international number ("+1 415 …") switches the country for you.
  function onNumberChange(value: string) {
    if (value.trim().startsWith("+")) {
      const match = matchPhone(`+${value.replace(/\D/g, "")}`);
      if (match) {
        onCountry(match.country);
        onNational(match.national);
        return;
      }
    }
    onNational(value);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(joinPhone(country, national));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <LogoMark size={72} />
      <h1 className="mt-6 text-2xl font-semibold">Welcome to Signal</h1>
      <p className="mt-2 text-sm text-fg-2">Enter your phone number to get started.</p>

      <form onSubmit={submit} className="mt-8 w-full space-y-3 text-left">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Country</span>
          <select
            value={`${country.name}`}
            onChange={(event) =>
              onCountry(COUNTRIES.find((c) => c.name === event.target.value) ?? COUNTRIES[0])
            }
            className="h-11 w-full rounded-lg bg-field px-3 text-sm outline-none focus:ring-2 focus:ring-accent"
          >
            {COUNTRIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.dial})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-fg-2">Phone number</span>
          <div className="flex h-11 items-center rounded-lg bg-field focus-within:ring-2 focus-within:ring-accent">
            <span className="pl-3 text-sm text-fg-2">{country.dial}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              value={national}
              onChange={(event) => onNumberChange(event.target.value)}
              placeholder="Phone number"
              maxLength={20}
              aria-invalid={error ? true : undefined}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-fg-3"
            />
          </div>
        </label>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={!valid} loading={busy}>
          Next
        </Button>
      </form>

      <section className="mt-10 w-full rounded-xl border border-line p-4 text-left">
        <h2 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">Demo accounts</h2>
        <p className="mt-1 text-xs text-fg-3">
          Verification is mocked. Tap a seeded account to sign in with code 123456.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.phone}>
              <button
                type="button"
                onClick={() => onDemo(account)}
                className="w-full rounded-lg bg-field px-3 py-2 text-left transition-colors hover:bg-selected"
              >
                <span className="block truncate text-sm font-medium">{account.name}</span>
                <span className="block truncate text-xs text-fg-3">
                  {prettyPhone(account.phone)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CodeStep({
  phone,
  hint,
  onBack,
}: {
  phone: string;
  hint: string | null;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function verify(value: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await authApi.verifyOtp(phone, value);
      useAuthStore.getState().signIn(response); // AuthGate redirects from here
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong. Try again.");
      setCode("");
      setBusy(false);
      submitting.current = false;
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <button
        type="button"
        onClick={onBack}
        className="mr-auto mb-6 inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        <ArrowLeft size={16} /> Edit number
      </button>
      <LogoMark size={56} />
      <h1 className="mt-5 text-2xl font-semibold">Enter your code</h1>
      <p className="mt-2 text-sm text-fg-2">
        We sent a code to <span className="font-medium text-fg">{prettyPhone(phone)}</span>
      </p>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={CODE_LENGTH}
        value={code}
        disabled={busy}
        aria-label="Verification code"
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(next);
          // Submit automatically as soon as the last digit is typed.
          if (next.length === CODE_LENGTH) void verify(next);
        }}
        placeholder="······"
        className={cn(
          "mt-8 h-14 w-56 rounded-lg bg-field text-center text-2xl font-semibold tracking-[0.5em] outline-none",
          "placeholder:text-fg-3 focus:ring-2 focus:ring-accent disabled:opacity-60",
          error && "ring-2 ring-danger",
        )}
      />

      <p className="mt-3 min-h-5 text-sm" role={error ? "alert" : undefined}>
        {error ? (
          <span className="text-danger">{error}</span>
        ) : (
          <span className="text-fg-3">{hint}</span>
        )}
      </p>

      <Button
        size="lg"
        className="mt-6 w-56"
        loading={busy}
        disabled={code.length !== CODE_LENGTH}
        onClick={() => void verify(code)}
      >
        Verify
      </Button>
    </div>
  );
}
